"""
chain_registry.py
Writes simulation verdicts to SimulationRegistry.sol v2 on the appropriate chain.
Chain selection is driven by chain_config.py — no addresses are hardcoded here.

Required env vars:
  REGISTRY_SIGNER_KEY   — private key of the reporter wallet
  Per-chain RPC URLs    — resolved via chain_config.py
"""

import os
import asyncio
import logging
from web3 import Web3

from chain_config import get_chain_by_id

logger = logging.getLogger(__name__)

# ABI for SimulationRegistry.sol v2 logSimulation()
REGISTRY_ABI = [
    {
        "type": "function",
        "name": "logSimulation",
        "inputs": [
            {"name": "sessionId",    "type": "bytes32"},
            {"name": "agent",        "type": "address"},
            {"name": "txHash",       "type": "bytes32"},
            {"name": "safeToExecute","type": "bool"},
            {"name": "flagsBitmap",  "type": "uint16"},
            {"name": "gasEstimate",  "type": "uint64"},
            {"name": "revertReason", "type": "string"},
            {"name": "chainId",      "type": "uint32"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    }
]

# ABI for SimulationRegistryV3.sol logSimulation()
REGISTRY_ABI_V3 = [
    {
        "type": "function",
        "name": "logSimulation",
        "inputs": [
            {"name": "sessionId",    "type": "bytes32"},
            {"name": "agent",        "type": "address"},
            {"name": "txHash",       "type": "bytes32"},
            {"name": "safeToExecute","type": "bool"},
            {"name": "flagsBitmap",  "type": "uint16"},
            {"name": "gasEstimate",  "type": "uint64"},
            {"name": "revertReason", "type": "string"},
            {"name": "chainId",      "type": "uint32"},
            {"name": "evidenceHash", "type": "bytes32"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    }
]

# Flag bit positions — must match SimulationRegistry.sol v2 FLAG_* constants (uint16)
_FLAG_REVERT                 = 1 << 0
_FLAG_HIGH_SLIPPAGE          = 1 << 1
_FLAG_MEV_RISK               = 1 << 2
_FLAG_GAS_ESTIMATE_HIGH      = 1 << 3
_FLAG_LOW_REPUTATION         = 1 << 4
_FLAG_UNKNOWN_AGENT          = 1 << 5
_FLAG_PRICE_IMPACT_HIGH      = 1 << 6
_FLAG_INSUFFICIENT_LIQUIDITY = 1 << 7
_FLAG_BRIDGE_RISK            = 1 << 8
_FLAG_ORACLE_MANIPULATION    = 1 << 9
_FLAG_VALUE_TRANSFER         = 1 << 10
_FLAG_CONTRACT_CREATION      = 1 << 11

# Mainnet chain IDs
ARBITRUM_ONE_CHAIN_ID   = 42161
AVALANCHE_MAINNET_CHAIN_ID = 43114


def _uuid_to_bytes32(session_id: str) -> bytes:
    """UUID string → 32 bytes (16-byte UUID value left-justified, zero-padded)."""
    raw = bytes.fromhex(session_id.replace("-", ""))  # 16 bytes
    return raw.ljust(32, b"\x00")


def _build_flags(results: dict) -> int:
    flags = 0

    if results.get("status") == "REJECTED":
        flags |= _FLAG_REVERT

    try:
        slippage = float(str(results.get("slippage_detected", "0")).replace("%", ""))
        if slippage > 5.0:
            flags |= _FLAG_HIGH_SLIPPAGE
    except (ValueError, TypeError):
        pass

    mev = results.get("timeboost_mev_telemetry") or {}
    if mev.get("sandwich_risk_detected") or mev.get("front_run_risk"):
        flags |= _FLAG_MEV_RISK

    try:
        gas_used = int(results.get("gas_used") or 0)
        gas_limit = int(results.get("gas_limit") or 0)
        if gas_limit and gas_used / gas_limit > 0.9:
            flags |= _FLAG_GAS_ESTIMATE_HIGH
    except (ValueError, TypeError, ZeroDivisionError):
        pass

    chain_extras = results.get("chain_extras") or {}
    if chain_extras.get("low_agent_reputation"):
        flags |= _FLAG_LOW_REPUTATION
    if not chain_extras.get("erc8004_is_registered", True):
        flags |= _FLAG_UNKNOWN_AGENT

    safety = results.get("safety_checks") or {}
    if safety.get("price_impact_high"):
        flags |= _FLAG_PRICE_IMPACT_HIGH
    if safety.get("insufficient_liquidity"):
        flags |= _FLAG_INSUFFICIENT_LIQUIDITY
    if safety.get("bridge_risk"):
        flags |= _FLAG_BRIDGE_RISK
    if safety.get("oracle_manipulation"):
        flags |= _FLAG_ORACLE_MANIPULATION
    if safety.get("value_transfer"):
        flags |= _FLAG_VALUE_TRANSFER
    if safety.get("contract_creation"):
        flags |= _FLAG_CONTRACT_CREATION

    return flags


def _sync_log(session_id: str, results: dict, chain_id: int) -> str:
    """Synchronous web3 call — intended to run in a thread executor."""
    private_key = os.getenv("REGISTRY_SIGNER_KEY") or os.getenv("DEPLOYER_PRIVATE_KEY")
    if not private_key:
        raise EnvironmentError(
            "REGISTRY_SIGNER_KEY (or DEPLOYER_PRIVATE_KEY) not set — skipping on-chain write"
        )

    try:
        chain = get_chain_by_id(chain_id)
    except ValueError:
        raise EnvironmentError(f"No chain config for chain_id={chain_id} — skipping registry write")

    registry_address = chain.registry_address
    if not registry_address:
        raise EnvironmentError(
            f"No registry address configured for {chain.name} (chain_id={chain_id}) — skipping"
        )

    rpc_url = chain.rpc_url
    if not rpc_url:
        raise EnvironmentError(f"No RPC URL for {chain.name} — skipping registry write")

    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
    if not w3.is_connected():
        raise ConnectionError(f"Cannot connect to {chain.name} at {rpc_url}")

    version = getattr(chain, "registry_version", 2)
    abi = REGISTRY_ABI_V3 if version == 3 else REGISTRY_ABI

    contract = w3.eth.contract(
        address=Web3.to_checksum_address(registry_address),
        abi=abi,
    )
    account = w3.eth.account.from_key(private_key)

    safe_to_execute = results.get("status") == "APPROVED"

    # agent: the wallet/agent address from the simulated transaction
    raw_agent = results.get("agent_address") or results.get("from_address") or "0x" + "0" * 40
    agent = Web3.to_checksum_address(raw_agent)

    # txHash: simulated tx hash if available, else zero bytes
    raw_tx_hash = results.get("tx_hash") or ("0x" + "0" * 64)
    tx_hash_bytes = bytes.fromhex(raw_tx_hash.removeprefix("0x").zfill(64))

    try:
        gas_estimate = min(int(results.get("gas_used") or 0), 2**64 - 1)
    except (ValueError, TypeError):
        gas_estimate = 0

    revert_reason = (results.get("revert_reason") or "")[:256]
    flags = _build_flags(results)

    latest = w3.eth.get_block("latest")
    base_fee = latest.get("baseFeePerGas", w3.to_wei("0.1", "gwei"))
    priority = w3.to_wei("0.01", "gwei")
    max_fee = base_fee * 2 + priority

    if version == 3:
        raw_evidence_hash = results.get("evidence_hash") or ("0x" + "0" * 64)
        evidence_hash_bytes = bytes.fromhex(raw_evidence_hash.removeprefix("0x").zfill(64))

        tx = contract.functions.logSimulation(
            _uuid_to_bytes32(session_id),
            agent,
            tx_hash_bytes,
            safe_to_execute,
            flags,
            gas_estimate,
            revert_reason,
            chain_id,
            evidence_hash_bytes,
        ).build_transaction({
            "from":                 account.address,
            "nonce":                w3.eth.get_transaction_count(account.address, "pending"),
            "gas":                  220_000,
            "maxFeePerGas":         max_fee,
            "maxPriorityFeePerGas": priority,
            "chainId":              chain_id,
        })
    else:
        tx = contract.functions.logSimulation(
            _uuid_to_bytes32(session_id),
            agent,
            tx_hash_bytes,
            safe_to_execute,
            flags,
            gas_estimate,
            revert_reason,
            chain_id,
        ).build_transaction({
            "from":                 account.address,
            "nonce":                w3.eth.get_transaction_count(account.address, "pending"),
            "gas":                  200_000,
            "maxFeePerGas":         max_fee,
            "maxPriorityFeePerGas": priority,
            "chainId":              chain_id,
        })

    signed = w3.eth.account.sign_transaction(tx, private_key)
    tx_hash_out = w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash_out, timeout=60)

    if receipt["status"] != 1:
        raise RuntimeError(f"Registry tx reverted: 0x{tx_hash_out.hex()}")

    return f"0x{tx_hash_out.hex()}"


async def log_simulation_to_chain(session_id: str, results: dict,
                                   chain_id: int = ARBITRUM_ONE_CHAIN_ID) -> str | None:
    """
    Async wrapper — runs the blocking web3 call in the default executor.
    Defaults to Arbitrum One mainnet. Never raises; logs errors so the
    worker loop is never interrupted.
    """
    try:
        tx_hash = await asyncio.get_event_loop().run_in_executor(
            None, _sync_log, session_id, results, chain_id
        )
        print(f"[{session_id}] On-chain registry ✓  tx={tx_hash}")
        logger.info("[%s] On-chain registry ✓  tx=%s", session_id, tx_hash)
        return tx_hash
    except EnvironmentError as exc:
        print(f"[{session_id}] Registry skipped: {exc}")
        logger.warning("[%s] Registry skipped: %s", session_id, exc)
        return None
    except Exception as exc:
        print(f"[{session_id}] Registry write failed (non-fatal): {exc}")
        logger.error("[%s] Registry write failed (non-fatal): %s", session_id, exc)
        import traceback
        traceback.print_exc()
        return None
