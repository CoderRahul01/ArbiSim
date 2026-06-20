"""
analyzers/base.py
Abstract base class and shared data structures for chain-specific analysis.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class SimulationFlags:
    # Universal flags
    execution_reverted: bool = False
    high_slippage: bool = False
    mev_sandwich_risk: bool = False
    unsafe_allowance: bool = False
    insufficient_collateral: bool = False
    # Arbitrum-specific (always False on other chains)
    stylus_ink_overflow: bool = False
    timeboost_recommended: bool = False
    # Avalanche-specific (always False on other chains)
    low_agent_reputation: bool = False
    x402_payment_risk: bool = False

    def to_bitmap(self) -> int:
        """Pack flags into uint8 for SimulationRegistry.sol logSimulation()."""
        bits = [
            self.execution_reverted,    # bit 0
            self.high_slippage,         # bit 1
            self.mev_sandwich_risk,     # bit 2
            self.unsafe_allowance,      # bit 3
            self.stylus_ink_overflow,   # bit 4
            self.insufficient_collateral,  # bit 5
            self.timeboost_recommended, # bit 6
            self.low_agent_reputation,  # bit 7
        ]
        return sum(int(bit) << i for i, bit in enumerate(bits))


@dataclass
class GasReport:
    gas_used: int
    gas_price_wei: int
    total_fee_wei: int
    total_fee_usd: Optional[float]
    l1_fee_wei: Optional[int]
    l2_fee_wei: Optional[int]
    native_token: str

    def gas_cost_eth(self) -> str:
        return f"{self.total_fee_wei / 1e18:.8f}"

    def gas_breakdown(self, extra: dict = None) -> dict:
        d = {
            "l2_gas_used": self.gas_used,
            "total_fees_wei": str(self.total_fee_wei),
        }
        if self.l1_fee_wei is not None:
            d["l1_gas_buffer"] = self.l1_fee_wei
        if self.l2_fee_wei is not None:
            d["l2_gas_used_with_penalty"] = self.l2_fee_wei
        if extra:
            d.update(extra)
        return d


@dataclass
class MEVReport:
    risk_score: float
    sandwich_detected: bool
    front_run_risk: bool
    details: str
    timeboost_fastlane_recommended: bool = False
    estimated_timeboost_premium_wei: str = "0"
    latency_advantage_ms: int = 0

    def to_telemetry(self) -> dict:
        return {
            "mev_sandwich_risk_score": round(self.risk_score, 2),
            "vulnerability_status": (
                "HIGH" if self.risk_score >= 0.7
                else "MEDIUM" if self.risk_score >= 0.4
                else "LOW"
            ),
            "sandwich_risk_detected": self.sandwich_detected,
            "timeboost_fastlane_recommended": self.timeboost_fastlane_recommended,
            "estimated_timeboost_premium_wei": self.estimated_timeboost_premium_wei,
            "latency_advantage_ms": self.latency_advantage_ms,
        }


class ChainAnalyzer(ABC):
    """
    One subclass per chain family.
    analytical_brain.py calls these methods and assembles the final telemetry dict.
    """

    @abstractmethod
    def compute_gas(self, gas_used: int, transactions: list, struct_logs: list,
                    host_io_penalty: float, w3) -> GasReport:
        """Compute full gas cost including any chain-specific components."""

    @abstractmethod
    def compute_mev_risk(self, transactions: list, gas_used: int,
                         chain_config) -> MEVReport:
        """Score MEV exposure for this transaction batch on this chain."""

    @abstractmethod
    def compute_stylus_ink(self, struct_logs: list, touched_addresses: set,
                           w3) -> tuple[int, float]:
        """
        Returns (total_ink, host_io_penalty_gas).
        Non-Arbitrum chains should return (0, 0.0).
        """

    @abstractmethod
    def get_token_addresses(self) -> dict[str, str]:
        """Return {token_address: symbol} for the tokens to track on this chain."""

    @abstractmethod
    def get_price_usd(self, symbol: str, w3) -> float:
        """Fetch USD price for a token symbol using chain-specific oracles."""

    def chain_specific_report(self, transactions: list, chain_config, w3=None) -> dict:
        """Optional extra fields appended to the telemetry doc."""
        return {}
