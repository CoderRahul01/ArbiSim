"""
Smoke test: Avalanche Fuji simulation with live ERC-8004 registry.

Usage:  cd workers && python test_avalanche.py

Requires:
  - anvil in PATH
  - .env with AVALANCHE_FUJI_RPC, ERC8004_REGISTRY_FUJI, AVALANCHE_FUJI_REGISTRY
"""

import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

from simulation_engine import AnvilForkInstance
from analytical_brain import AnalyticalBrain
from chain_config import get_chain

# ── Constants ─────────────────────────────────────────────────────────────

FROM_ADDRESS   = "0xF9E956c879652342CaF1c9b4F2879836AA31Ef18"
FUJI_USDC      = "0x5425890298aed601595a70AB815c96711a31Bc65"

# Pre-registered in MockERC8004Registry.sol by DeployFuji.s.sol
LOW_REP_AGENT  = "0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF"  # score 12
TRUSTED_AGENT  = "0x742d35Cc6634C0532925a3b8A4Bc454e4438f44e"  # score 92


def build_x402_tx(to_address: str) -> dict:
    """Build ERC-20 transfer(address,uint256) calldata for 1 USDC."""
    padded_to   = to_address[2:].lower().zfill(64)
    amount_hex  = hex(1_000_000)[2:].zfill(64)  # 1 USDC (6 decimals)
    return {
        "to":       FUJI_USDC,
        "data":     f"0xa9059cbb{padded_to}{amount_hex}",
        "value":    "0",
        "gas":      "0x30D40",
    }


async def run_simulation(label: str, to_address: str) -> dict:
    print(f"\n{'='*60}")
    print(f"TEST: {label}")
    print(f"  from:  {FROM_ADDRESS}")
    print(f"  payee: {to_address}")
    print(f"{'='*60}")

    chain  = get_chain("avalanche-fuji")
    anvil  = AnvilForkInstance("avalanche-fuji")

    try:
        rpc_url = await anvil.start()
        brain   = AnalyticalBrain(rpc_url, chain_config=chain)

        result = brain.execute_simulation(
            agent_address=FROM_ADDRESS,
            transactions=[build_x402_tx(to_address)],
            max_slippage=0.0,
        )
        print(json.dumps(result, indent=2, default=str))
        return result
    finally:
        await anvil.stop()


def assert_result(result: dict, label: str, expect_low_rep: bool) -> None:
    errors = []

    chain_extras = result.get("chain_extras", {})

    if chain_extras.get("chain_family") != "avalanche":
        errors.append(f"chain_family={chain_extras.get('chain_family')!r}, expected 'avalanche'")

    if result.get("stylus_ink_consumed", -1) != 0:
        errors.append(f"stylus_ink_consumed={result['stylus_ink_consumed']}, expected 0")

    if result.get("timeboost_mev_telemetry", {}).get("timeboost_fastlane_recommended") is not False:
        errors.append("timeboost_fastlane_recommended should be False")

    gas_bd = result.get("gas_breakdown", {})
    if "l1_gas_buffer" in gas_bd and gas_bd["l1_gas_buffer"] not in (None, 0):
        errors.append(f"l1_gas_buffer present with non-zero value: {gas_bd['l1_gas_buffer']}")

    erc8004_configured = chain_extras.get("erc8004_registry_configured", False)
    if not erc8004_configured:
        errors.append("erc8004_registry_configured=False — env var ERC8004_REGISTRY_FUJI not loaded")

    actual_low_rep = chain_extras.get("low_agent_reputation")
    if actual_low_rep != expect_low_rep:
        score = chain_extras.get("erc8004_reputation_score")
        errors.append(
            f"low_agent_reputation={actual_low_rep}, expected {expect_low_rep} "
            f"(reputation_score={score})"
        )

    actual_x402 = chain_extras.get("x402_payment_risk")
    if actual_x402 != expect_low_rep:  # x402 risk matches low rep (both true for low-rep payee)
        errors.append(f"x402_payment_risk={actual_x402}, expected {expect_low_rep}")

    if errors:
        print(f"\n[FAIL] {label}")
        for e in errors:
            print(f"  ✗ {e}")
        raise AssertionError(f"{len(errors)} assertion(s) failed for '{label}'")

    print(f"\n[PASS] {label}")
    print(f"  status:              {result['status']}")
    print(f"  gas_cost_eth:        {result['gas_cost_eth']} AVAX")
    print(f"  chain_family:        {chain_extras['chain_family']}")
    print(f"  erc8004_configured:  {erc8004_configured}")
    print(f"  reputation_score:    {chain_extras.get('erc8004_reputation_score')}")
    print(f"  is_registered:       {chain_extras.get('erc8004_is_registered')}")
    print(f"  low_rep:             {chain_extras.get('low_agent_reputation')}")
    print(f"  x402_risk:           {chain_extras.get('x402_payment_risk')}")


async def main():
    registry = os.getenv("ERC8004_REGISTRY_FUJI", "")
    print("ArbiSim Guard — Avalanche Fuji ERC-8004 integration test")
    print(f"ERC8004_REGISTRY_FUJI = {registry or '(not set — live check will be skipped)'}")
    print(f"AVALANCHE_FUJI_REGISTRY = {os.getenv('AVALANCHE_FUJI_REGISTRY', '(not set)')}")

    # Test A: Low reputation payee (score 12) — should flag
    result_low = await run_simulation(
        "Test A — Low-rep payee (score 12, expect FLAG)",
        LOW_REP_AGENT,
    )
    assert_result(result_low, "Test A — Low-rep payee", expect_low_rep=True)

    # Test B: Trusted payee (score 92) — should be clean
    result_trusted = await run_simulation(
        "Test B — Trusted payee (score 92, expect CLEAN)",
        TRUSTED_AGENT,
    )
    assert_result(result_trusted, "Test B — Trusted payee", expect_low_rep=False)

    print("\n" + "="*60)
    print("ALL TESTS PASSED")
    print()
    print("Test A flags (low-rep payee):")
    for k, v in result_low["chain_extras"].items():
        if k in ("low_agent_reputation", "x402_payment_risk", "erc8004_reputation_score", "erc8004_is_registered"):
            print(f"  {k}: {v}")
    print()
    print("Test B flags (trusted payee):")
    for k, v in result_trusted["chain_extras"].items():
        if k in ("low_agent_reputation", "x402_payment_risk", "erc8004_reputation_score", "erc8004_is_registered"):
            print(f"  {k}: {v}")
    print("="*60)


if __name__ == "__main__":
    asyncio.run(main())
