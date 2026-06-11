"""
chain_registry.py
Writes simulation verdicts to SimulationRegistry.sol on Arbitrum Sepolia.

Required env vars:
  REGISTRY_SIGNER_KEY          — private key of the contract owner wallet
  ARB_SEPOLIA_RPC_URL          — Arbitrum Sepolia RPC (Alchemy / public fallback)
  REGISTRY_CONTRACT_ADDRESS    — deployed contract address (optional override)
"""

import os
import asyncio
import logging
from web3 import Web3

logger = logging.getLogger(__name__)

REGISTRY_ADDRESS = os.getenv(
    "REGISTRY_CONTRACT_ADDRESS",
    "0x5Dfd08c3d44BEBfa61a24Af8c2EfbDB5A01dFA32",
)

REGISTRY_ABI = [
    {
        "type": "function",
        "name": "logSimulation",
        "inputs": [
            {"name": "sessionId",    "type": "bytes32"},
            {"name": "passed",       "type": "bool"},
            {"name": "gasCostWei",   "type": "uint256"},
            {"name": "revertReason", "type": "string"},
            {"name": "flagsBitmap",  "type": "uint8"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    }
]

# Flag bit positions — must match the contract constants
_FLAG_EXECUTION_REVERTED    = 1 << 0
_FLAG_HIGH_SLIPPAGE         = 1 << 1
_FLAG_SANDWICH_DETECTED     = 1 << 2
_FLAG_TIMEBOOST_RECOMMENDED = 1 << 6


def _uuid_to_bytes32(session_id: str) -> bytes:
    """UUID string → 32 bytes (16-byte UUID value left-justified, zero-padded)."""
    raw = bytes.fromhex(session_id.replace("-", ""))  # 16 bytes
    return raw.ljust(32, b"\x00")


def _build_flags(results: dict) -> int:
    flags = 0
    if results.get("status") == "REJECTED":
        flags |= _FLAG_EXECUTION_REVERTED

    try:
        slippage = float(str(results.get("slippage_detected", "0")).replace("%", ""))
        if slippage > 5.0:
            flags |= _FLAG_HIGH_SLIPPAGE
    except (ValueError, TypeError):
        pass

    mev = results.get("timeboost_mev_telemetry") or {}
    if mev.get("sandwich_risk_detected"):
        flags |= _FLAG_SANDWICH_DETECTED
    if mev.get("timeboost_recommended"):
        flags |= _FLAG_TIMEBOOST_RECOMMENDED

    return flags


def _sync_log(session_id: str, results: dict) -> str:
    """Synchronous web3 call — intended to run in a thread executor."""
    private_key = os.getenv("REGISTRY_SIGNER_KEY")
    if not private_key:
        raise EnvironmentError("REGISTRY_SIGNER_KEY not set — skipping on-chain write")

    rpc_url = os.getenv("ARB_SEPOLIA_RPC_URL", "https://sepolia-rollup.arbitrum.io/rpc")
    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to Arbitrum Sepolia at {rpc_url}")

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(REGISTRY_ADDRESS),
        abi=REGISTRY_ABI,
    )
    account = w3.eth.account.from_key(private_key)

    passed = results.get("status") == "APPROVED"
    try:
        gas_cost_wei = int(float(results.get("gas_cost_eth", "0")) * 1e18)
    except (ValueError, TypeError):
        gas_cost_wei = 0
    revert_reason = results.get("revert_reason") or ""
    flags = _build_flags(results)

    # Fetch base fee and build EIP-1559 tx
    latest = w3.eth.get_block("latest")
    base_fee = latest.get("baseFeePerGas", w3.to_wei("0.1", "gwei"))
    priority  = w3.to_wei("0.01", "gwei")
    max_fee   = base_fee * 2 + priority

    tx = contract.functions.logSimulation(
        _uuid_to_bytes32(session_id),
        passed,
        gas_cost_wei,
        revert_reason,
        flags,
    ).build_transaction({
        "from":                 account.address,
        "nonce":                w3.eth.get_transaction_count(account.address, "pending"),
        "gas":                  200_000,
        "maxFeePerGas":         max_fee,
        "maxPriorityFeePerGas": priority,
        "chainId":              421614,  # Arbitrum Sepolia
    })

    signed  = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

    if receipt["status"] != 1:
        raise RuntimeError(f"Registry tx reverted: 0x{tx_hash.hex()}")

    return f"0x{tx_hash.hex()}"


async def log_simulation_to_chain(session_id: str, results: dict) -> None:
    """
    Async wrapper — runs the blocking web3 call in the default executor.
    Never raises; logs errors so the worker loop is never interrupted.
    """
    try:
        tx_hash = await asyncio.get_event_loop().run_in_executor(
            None, _sync_log, session_id, results
        )
        print(f"[{session_id}] On-chain registry ✓  tx={tx_hash}")
    except EnvironmentError as exc:
        # Signer key not configured — expected in local/CI environments
        logger.warning("[%s] Registry skipped: %s", session_id, exc)
    except Exception as exc:
        # Non-fatal — simulation result already persisted to Neon + MongoDB
        logger.error("[%s] Registry write failed (non-fatal): %s", session_id, exc)
