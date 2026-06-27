"""
analyzers/base.py
Abstract base class and shared data structures for chain-specific analysis.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional


@dataclass
class SimulationFlags:
    # Bits map 1-to-1 to SimulationRegistry.sol v2 FLAG_* constants (uint16).
    revert: bool = False                 # FLAG_REVERT                 = 1 << 0
    high_slippage: bool = False          # FLAG_HIGH_SLIPPAGE          = 1 << 1
    mev_risk: bool = False               # FLAG_MEV_RISK               = 1 << 2
    gas_estimate_high: bool = False      # FLAG_GAS_ESTIMATE_HIGH      = 1 << 3
    low_reputation: bool = False         # FLAG_LOW_REPUTATION         = 1 << 4
    unknown_agent: bool = False          # FLAG_UNKNOWN_AGENT          = 1 << 5
    price_impact_high: bool = False      # FLAG_PRICE_IMPACT_HIGH      = 1 << 6
    insufficient_liquidity: bool = False # FLAG_INSUFFICIENT_LIQUIDITY = 1 << 7
    bridge_risk: bool = False            # FLAG_BRIDGE_RISK            = 1 << 8
    oracle_manipulation: bool = False    # FLAG_ORACLE_MANIPULATION    = 1 << 9
    value_transfer: bool = False         # FLAG_VALUE_TRANSFER         = 1 << 10
    contract_creation: bool = False      # FLAG_CONTRACT_CREATION      = 1 << 11
    # Display-only — not written to the contract bitmap
    x402_payment_risk: bool = False

    def to_bitmap(self) -> int:
        """Pack flags into uint16 for SimulationRegistry.sol v2 logSimulation()."""
        bits = [
            self.revert,                 # bit 0
            self.high_slippage,          # bit 1
            self.mev_risk,               # bit 2
            self.gas_estimate_high,      # bit 3
            self.low_reputation,         # bit 4
            self.unknown_agent,          # bit 5
            self.price_impact_high,      # bit 6
            self.insufficient_liquidity, # bit 7
            self.bridge_risk,            # bit 8
            self.oracle_manipulation,    # bit 9
            self.value_transfer,         # bit 10
            self.contract_creation,      # bit 11
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
