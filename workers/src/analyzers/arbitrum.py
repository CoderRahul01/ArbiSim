"""
analyzers/arbitrum.py
Arbitrum Nitro-specific analysis: 2D gas (Brotli L1 buffer), Timeboost MEV,
Stylus ink consumption, and Chainlink price feeds on Arbitrum.
"""

import brotli
from web3 import Web3

from .base import ChainAnalyzer, GasReport, MEVReport, SimulationFlags

# ── Arbitrum contract addresses ─────────────────────────────────────────────
GAS_PRICE_ORACLE = "0x00000000000000000000000000000000000000c8"
CHAINLINK_ETH_USD = "0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612"
CHAINLINK_BTC_USD = "0x6ce18521331128284c21533Cd7d9Cc01086e8F35"

# Arbitrum One token addresses
ARBITRUM_TOKENS = {
    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831": "USDC",
    "0x82aF49447D8a07e3bd95BD0d56f352415231aa11": "WETH",
    "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f": "WBTC",
}

CHAINLINK_ABI = [
    {
        "inputs": [],
        "name": "latestAnswer",
        "outputs": [{"name": "", "type": "int256"}],
        "stateMutability": "view",
        "type": "function",
    }
]

# MEV-prone protocol entry points on Arbitrum
_MEV_PRONE_TARGETS = {
    "0xc873fecbd354f5afca31422734b5267d343f117a",  # Camelot Router
    "0x3b123f1c1665ea07fab53363537950da84e1ba7d",  # GMX Vault
}


class ArbitrumAnalyzer(ChainAnalyzer):

    def compute_stylus_ink(self, struct_logs: list, touched_addresses: set, w3) -> tuple:
        """Identify Stylus WASM contracts and compute ink + host I/O penalty."""
        stylus_contracts = set()
        for addr in touched_addresses:
            try:
                code = w3.eth.get_code(addr)
                if code.startswith(b'\xef\xf0\x00'):
                    stylus_contracts.add(addr)
            except Exception:
                pass

        total_ink = 0
        host_io_penalty_gas = 0.0
        call_stack = []
        current_addr = None

        for log in struct_logs:
            op = log.get("op", "")
            if op in ["CALL", "DELEGATECALL", "STATICCALL", "CALLCODE"] and "stack" in log:
                try:
                    target_hex = log["stack"][-2]
                    target_addr = Web3.to_checksum_address("0x" + target_hex[-40:])
                    call_stack.append(target_addr)
                    current_addr = target_addr
                except Exception:
                    pass
            elif op in ["RETURN", "STOP", "REVERT", "SELFDESTRUCT"]:
                if call_stack:
                    call_stack.pop()
                    current_addr = call_stack[-1] if call_stack else None

            if current_addr in stylus_contracts:
                gas_cost = log.get("gasCost", 0)
                total_ink += int(gas_cost * 10000)
                if op in ["SLOAD", "SSTORE", "LOG0", "LOG1", "LOG2", "LOG3", "LOG4"]:
                    host_io_penalty_gas += 0.84
                    total_ink += int(0.84 * 10000)

        return total_ink, host_io_penalty_gas

    def compute_gas(self, gas_used: int, transactions: list, struct_logs: list,
                    host_io_penalty: float, w3) -> GasReport:
        """
        Arbitrum Nitro 2D fee:
          total = L2_gas_price * (L2_gas_used + host_io_penalty + L1_calldata_buffer)
        L1 buffer = brotli-zero compressed calldata size * 16 / L2_base_fee
        """
        try:
            l2_base_fee = w3.eth.get_block('latest')['baseFeePerGas']
        except Exception:
            l2_base_fee = w3.eth.gas_price

        total_l1_buffer_gas = 0.0
        for tx in transactions:
            calldata_hex = tx.get("data", "0x")
            calldata = calldata_hex[2:] if calldata_hex.startswith("0x") else calldata_hex
            calldata_bytes = bytes.fromhex(calldata) if calldata else b''
            if calldata_bytes:
                try:
                    compressed = brotli.compress(calldata_bytes, quality=0)
                    compressed_size = len(compressed)
                except Exception:
                    compressed_size = len(calldata_bytes)
                data_footprint = compressed_size * 16
                total_l1_buffer_gas += data_footprint / max(l2_base_fee, 1)

        l2_gas_price = w3.eth.gas_price
        l2_gas_used_with_penalty = gas_used + host_io_penalty
        total_fees_wei = int(l2_gas_price * (l2_gas_used_with_penalty + total_l1_buffer_gas))

        return GasReport(
            gas_used=gas_used,
            gas_price_wei=l2_gas_price,
            total_fee_wei=total_fees_wei,
            total_fee_usd=None,
            l1_fee_wei=int(l2_gas_price * total_l1_buffer_gas),
            l2_fee_wei=int(l2_gas_price * l2_gas_used_with_penalty),
            native_token="ETH",
        )

    def compute_mev_risk(self, transactions: list, gas_used: int, chain_config) -> MEVReport:
        """Timeboost-aware MEV scoring: target protocol + gas depth + calldata size."""
        first_tx = transactions[0] if transactions else {}
        calldata_hex = first_tx.get("data", "0x")
        calldata = calldata_hex[2:] if calldata_hex.startswith("0x") else calldata_hex
        calldata_bytes = bytes.fromhex(calldata) if calldata else b''
        target_contract = first_tx.get("to", "0x0000000000000000000000000000000000000000")

        is_high_risk_target = target_contract.lower() in _MEV_PRONE_TARGETS
        calldata_size = len(calldata_bytes)

        risk_score = 0.0
        if is_high_risk_target:
            risk_score += 0.5
        if gas_used > 150000:
            risk_score += 0.3
        if calldata_size > 512:
            risk_score += 0.2

        requires_timeboost = risk_score >= 0.6
        estimated_premium_wei = int(gas_used * 0.12) if requires_timeboost else 0

        return MEVReport(
            risk_score=round(risk_score, 2),
            sandwich_detected=risk_score >= 0.7,
            front_run_risk=risk_score >= 0.5,
            details="Arbitrum Timeboost MEV heuristic",
            timeboost_fastlane_recommended=requires_timeboost,
            estimated_timeboost_premium_wei=str(estimated_premium_wei),
            latency_advantage_ms=200 if requires_timeboost else 0,
        )

    def get_token_addresses(self) -> dict:
        return ARBITRUM_TOKENS

    def get_price_usd(self, symbol: str, w3) -> float:
        fallbacks = {"ETH": 3500.0, "WETH": 3500.0, "BTC": 65000.0, "WBTC": 65000.0, "USDC": 1.0}
        try:
            if symbol in ("ETH", "WETH"):
                feed = w3.eth.contract(address=CHAINLINK_ETH_USD, abi=CHAINLINK_ABI)
                return float(feed.functions.latestAnswer().call()) / 1e8
            if symbol in ("BTC", "WBTC"):
                feed = w3.eth.contract(address=CHAINLINK_BTC_USD, abi=CHAINLINK_ABI)
                return float(feed.functions.latestAnswer().call()) / 1e8
        except Exception:
            pass
        return fallbacks.get(symbol, 0.0)

    def chain_specific_report(self, transactions: list, chain_config, w3=None) -> dict:
        return {
            "chain_family": "arbitrum",
            "timeboost_enabled": chain_config.extra.get("timeboost_enabled", False) if chain_config else False,
            "stylus_enabled": chain_config.extra.get("stylus_enabled", False) if chain_config else False,
            "l1_data_fee": chain_config.extra.get("l1_data_fee", True) if chain_config else True,
        }
