"""
agent_runner.py
Pre-flight enforcement layer for deployed AI agents.

For every live action an agent wants to take:
  1. Simulates the transactions against live C-Chain state via Anvil fork
  2. Evaluates all safety gates from the agent spec
  3. Returns cleared_for_broadcast=True only if APPROVED + all gates pass

The caller (agent SDK, Vibekit, Eliza, LangGraph) reads cleared_for_broadcast.
ArbiSim Guard never broadcasts the mainnet transaction itself.

Safety Gates (evaluated in order):
  1. Simulation verdict (APPROVED/REJECTED from AnalyticalBrain)
  2. Slippage % > max_slippage_pct
  3. Gas cost in AVAX > max_gas_cost_avax
  4. Net P&L USD < min_net_pnl_usd
  5. MEV risk score > 0.5 (if reject_on_mev_risk=True)
"""

import asyncio
import logging
from typing import Optional

from simulation_engine import AnvilForkInstance
from analytical_brain import AnalyticalBrain
from chain_config import get_chain

logger = logging.getLogger(__name__)


class AgentRunner:
    """
    Wraps an agent spec and enforces pre-flight simulation on every action.
    Used for deployed agents executing live DeFi strategies on Avalanche.
    """

    def __init__(self, agent_spec: dict):
        """
        agent_spec must contain:
          network: str              - e.g. 'avalanche-mainnet'
          agent_address: str        - the agent's wallet address (0x...)
          safety_gates: dict        - max_slippage_pct, max_gas_cost_avax, min_net_pnl_usd,
                                      reject_on_mev_risk, reject_on_oracle_crash
        """
        self.spec = agent_spec
        self.network = agent_spec["network"]
        self.chain = get_chain(self.network)
        self.agent_address = agent_spec.get("agent_address", "0x" + "0" * 40)
        self.safety_gates = agent_spec.get("safety_gates", {})
        self.max_slippage = self.safety_gates.get("max_slippage_pct", 2.0)

    async def execute_action(
        self,
        transactions: list,
        context: Optional[dict] = None,
    ) -> dict:
        """
        Main entry point for pre-flight simulation.

        Simulates the transaction batch on a fresh Anvil fork at C-Chain head,
        applies safety gates, and returns the full report with cleared_for_broadcast flag.

        The caller must check cleared_for_broadcast before broadcasting to mainnet.
        ArbiSim Guard never broadcasts mainnet transactions.

        Args:
            transactions: list of {to, data, value, gasLimit?} dicts
            context: optional metadata (e.g. strategy name, timestamp) for logging

        Returns:
            dict with all AnalyticalBrain telemetry plus:
              cleared_for_broadcast: bool
              gate_verdict: 'APPROVED' | 'REJECTED'
              gate_reason: str | None
        """
        anvil = AnvilForkInstance(self.network)
        rpc_url = await anvil.start()
        snapshot_id = await anvil.take_snapshot()

        try:
            brain = AnalyticalBrain(rpc_url, chain_config=self.chain)
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: brain.execute_simulation(
                    agent_address=self.agent_address,
                    transactions=transactions,
                    max_slippage=self.max_slippage,
                ),
            )
        except Exception as exc:
            logger.error("[AgentRunner] simulation failed: %s", exc)
            return {
                "cleared_for_broadcast": False,
                "gate_verdict": "REJECTED",
                "gate_reason": f"Simulation engine error: {exc}",
                "status": "ERROR",
            }
        finally:
            if snapshot_id:
                await anvil.revert_snapshot(snapshot_id)
            await anvil.stop()

        verdict, reason = self._apply_safety_gates(result)
        result["gate_verdict"] = verdict
        result["gate_reason"] = reason
        result["cleared_for_broadcast"] = verdict == "APPROVED"

        logger.info(
            "[AgentRunner] agent=%s verdict=%s reason=%s slippage=%s gas=%s pnl=%s",
            self.agent_address[:10],
            verdict,
            reason,
            result.get("slippage_detected"),
            result.get("gas_cost_eth"),
            result.get("net_pnl_usd"),
        )
        return result

    def _apply_safety_gates(self, result: dict) -> tuple[str, Optional[str]]:
        """
        Evaluates all 5 safety gates in order.
        Returns (verdict, reason). Reason is None if APPROVED.
        """
        gates = self.safety_gates

        # Gate 1: Base simulation verdict
        if result.get("status") == "REJECTED":
            return "REJECTED", f"Simulation rejected: {result.get('revert_reason') or 'execution failed'}"

        # Gate 2: Slippage
        try:
            slippage_str = str(result.get("slippage_detected", "0%")).replace("%", "")
            slippage = float(slippage_str)
            max_slip = gates.get("max_slippage_pct", 2.0)
            if slippage > max_slip:
                return "REJECTED", f"Slippage {slippage:.2f}% exceeds max {max_slip}%"
        except (ValueError, TypeError):
            pass

        # Gate 3: Gas cost
        try:
            gas_avax = float(str(result.get("gas_cost_eth", "0")))
            max_gas = gates.get("max_gas_cost_avax", 0.05)
            if gas_avax > max_gas:
                return "REJECTED", f"Gas cost {gas_avax:.6f} AVAX exceeds max {max_gas} AVAX"
        except (ValueError, TypeError):
            pass

        # Gate 4: Net P&L floor
        try:
            pnl = float(str(result.get("net_pnl_usd", "0")).replace("+", ""))
            min_pnl = gates.get("min_net_pnl_usd", -10.0)
            if pnl < min_pnl:
                return "REJECTED", f"Net P&L ${pnl:.2f} is below floor ${min_pnl:.2f}"
        except (ValueError, TypeError):
            pass

        # Gate 5: MEV risk
        if gates.get("reject_on_mev_risk", True):
            mev = result.get("timeboost_mev_telemetry", {}) or {}
            mev_score = float(mev.get("mev_sandwich_risk_score", 0) or 0)
            sandwich = mev.get("sandwich_detected", False)
            if mev_score > 0.5 or sandwich:
                return "REJECTED", f"MEV risk detected (score={mev_score:.2f}, sandwich={sandwich})"

        return "APPROVED", None
