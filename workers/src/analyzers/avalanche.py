"""
analyzers/avalanche.py
Avalanche C-Chain specific analysis: clean EIP-1559 gas (no L1 component),
DEX-based MEV scoring (TraderJoe / Pangolin), ERC-8004 reputation check,
and x402 payment risk detection.
"""

from web3 import Web3

from .base import ChainAnalyzer, GasReport, MEVReport

# Avalanche C-Chain token addresses (mainnet)
AVALANCHE_TOKENS = {
    "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6e": "USDC",
    "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB": "WETH.e",
    "0x50b7545627a5162F82A992c33b87aDc75187B218": "WBTC.e",
}

CHAINLINK_AGGREGATOR_ABI = [
    {
        "inputs": [],
        "name": "latestRoundData",
        "outputs": [
            {"name": "roundId", "type": "uint80"},
            {"name": "answer", "type": "int256"},
            {"name": "startedAt", "type": "uint256"},
            {"name": "updatedAt", "type": "uint256"},
            {"name": "answeredInRound", "type": "uint80"},
        ],
        "stateMutability": "view",
        "type": "function",
    }
]

ERC8004_REGISTRY_ABI = [
    {
        "inputs": [{"name": "agent", "type": "address"}],
        "name": "getReputation",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "agent", "type": "address"}],
        "name": "isRegistered",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [{"name": "agent", "type": "address"}],
        "name": "isTrusted",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "view",
        "type": "function",
    },
]

# ERC-20 transfer(address,uint256) selector
_ERC20_TRANSFER_SELECTOR = "0xa9059cbb"

# Reputation threshold — below this = FLAG_LOW_AGENT_REPUTATION
_LOW_REPUTATION_THRESHOLD = 50


class AvalancheAnalyzer(ChainAnalyzer):

    def compute_stylus_ink(self, struct_logs: list, touched_addresses: set, w3) -> tuple:
        """Avalanche has no Stylus WASM. Always returns zero ink."""
        return 0, 0.0

    def compute_gas(self, gas_used: int, transactions: list, struct_logs: list,
                    host_io_penalty: float, w3) -> GasReport:
        """
        Clean EIP-1559 — no L1 calldata component, no Brotli compression.
        total_fee = gas_used * effectiveGasPrice (from latest block)
        """
        gas_price = w3.eth.gas_price
        total_fee_wei = gas_used * gas_price

        avax_price_usd = self._get_avax_price(w3, None)
        total_fee_usd = (total_fee_wei / 1e18) * avax_price_usd if avax_price_usd else None

        return GasReport(
            gas_used=gas_used,
            gas_price_wei=gas_price,
            total_fee_wei=total_fee_wei,
            total_fee_usd=total_fee_usd,
            l1_fee_wei=None,
            l2_fee_wei=None,
            native_token="AVAX",
        )

    def compute_mev_risk(self, transactions: list, gas_used: int, chain_config) -> MEVReport:
        """
        Avalanche DEX sandwich risk. Snowman sub-second finality shrinks the MEV window
        vs Arbitrum, but DEX-level sandwich still exists on TraderJoe and Pangolin.
        """
        first_tx = transactions[0] if transactions else {}
        target = first_tx.get("to", "").lower()
        known_dex = {r.lower() for r in (chain_config.known_dex_routers if chain_config else [])}

        risk = 0.0
        sandwich = False

        if target in known_dex:
            risk += 0.3
            calldata_hex = first_tx.get("data", "0x")
            calldata = calldata_hex[2:] if calldata_hex.startswith("0x") else calldata_hex
            calldata_bytes = bytes.fromhex(calldata) if calldata else b''
            if len(calldata_bytes) > 256:
                risk += 0.2
                sandwich = True

        return MEVReport(
            risk_score=round(min(risk, 1.0), 2),
            sandwich_detected=sandwich,
            front_run_risk=risk > 0.4,
            details="Avalanche DEX sandwich risk (TraderJoe/Pangolin)" if sandwich
                    else "Low MEV risk (Snowman sub-second finality)",
            timeboost_fastlane_recommended=False,
            estimated_timeboost_premium_wei="0",
            latency_advantage_ms=0,
        )

    def get_token_addresses(self) -> dict:
        return AVALANCHE_TOKENS

    def get_price_usd(self, symbol: str, w3) -> float:
        fallbacks = {"AVAX": 30.0, "USDC": 1.0, "WETH.e": 3500.0, "WBTC.e": 65000.0}
        return fallbacks.get(symbol, 0.0)

    def chain_specific_report(self, transactions: list, chain_config, w3=None) -> dict:
        """
        Returns Avalanche-specific telemetry fields including:
        - ERC-8004 reputation check result for each transaction payee
        - x402 payment risk flag
        - Chain metadata (Snowman finality, Warp messaging)
        """
        first_tx = transactions[0] if transactions else {}
        # For ERC-20 transfer, the real payee is encoded in calldata, not tx["to"]
        payee = self._extract_payee(first_tx)

        reputation_score = None
        is_registered = False
        low_reputation = False
        x402_risk = False

        if w3 and chain_config:
            reputation_score, low_reputation, is_registered = self._check_erc8004(
                payee, chain_config, w3
            )
            x402_risk = self._check_x402_risk(first_tx, low_reputation)

        return {
            "chain_family": "avalanche",
            "snowman_finality_ms": 500,
            "warp_messaging": chain_config.extra.get("warp_messaging", False) if chain_config else False,
            "erc8004_registry_configured": bool(
                chain_config.extra.get("erc8004_registry") if chain_config else False
            ),
            # Reputation check results — used by gateway to synthesise flags
            "erc8004_payee": payee,
            "erc8004_reputation_score": reputation_score,
            "erc8004_is_registered": is_registered,
            "low_agent_reputation": low_reputation,  # read by chain_registry._build_flags
            "erc8004_is_registered": is_registered,  # drives FLAG_UNKNOWN_AGENT
            "x402_payment_risk": x402_risk,
        }

    # ── Private helpers ──────────────────────────────────────────────────────

    def _check_erc8004(self, payee: str, chain_config, w3) -> tuple:
        """
        Query ERC-8004 registry inside the Anvil fork.
        Returns (score: int | None, is_low_rep: bool, is_registered: bool).
        Non-fatal — returns (None, False, False) on any error.
        """
        registry_addr = chain_config.extra.get("erc8004_registry", "")
        if not registry_addr or not payee:
            return None, False, False

        try:
            registry = w3.eth.contract(
                address=Web3.to_checksum_address(registry_addr),
                abi=ERC8004_REGISTRY_ABI,
            )
            payee_cs = Web3.to_checksum_address(payee)
            registered = registry.functions.isRegistered(payee_cs).call()
            score = registry.functions.getReputation(payee_cs).call()
            low_rep = not registered or score < _LOW_REPUTATION_THRESHOLD
            print(f"[ERC-8004] payee={payee} registered={registered} score={score} low_rep={low_rep}")
            return score, low_rep, registered
        except Exception as exc:
            print(f"[ERC-8004] check failed (non-fatal): {exc}")
            return None, False, False

    def _check_x402_risk(self, tx: dict, low_reputation: bool) -> bool:
        """
        Flag x402 payment risk: calldata matches ERC-20 transfer selector
        AND the payee has low/no ERC-8004 reputation.
        """
        calldata = tx.get("data", "0x") or "0x"
        is_transfer = calldata.startswith(_ERC20_TRANSFER_SELECTOR)
        return is_transfer and low_reputation

    def _extract_payee(self, tx: dict) -> str:
        """
        For ERC-20 transfer(address,uint256) calls, decode the recipient
        from the calldata (not tx["to"], which is the token contract).
        Falls back to tx["to"] for plain ETH sends.

        ABI encoding of transfer(address,uint256):
          selector    : 4 bytes (8 hex chars)
          recipient   : 32 bytes (64 hex chars) — address is right-aligned, last 40 chars
          amount      : 32 bytes (64 hex chars)
        """
        calldata = tx.get("data", "0x") or "0x"
        if calldata.startswith(_ERC20_TRANSFER_SELECTOR) and len(calldata) >= 74:
            raw = calldata[2:]          # strip "0x"
            payee_hex = raw[32:72]      # skip selector(8) + zero-padding(24), take addr(40)
            try:
                return Web3.to_checksum_address("0x" + payee_hex)
            except Exception:
                pass
        return tx.get("to", "")

    def _get_avax_price(self, w3, chain_config) -> float | None:
        """Fetch AVAX/USD from Chainlink. Falls back silently."""
        if not w3 or not chain_config or not chain_config.native_token_usd_feed:
            return None
        try:
            feed = w3.eth.contract(
                address=Web3.to_checksum_address(chain_config.native_token_usd_feed),
                abi=CHAINLINK_AGGREGATOR_ABI,
            )
            _, answer, _, _, _ = feed.functions.latestRoundData().call()
            return answer / 1e8
        except Exception:
            return None
