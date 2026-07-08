import json
from eth_utils import keccak

def build_evidence_report(results: dict) -> list[dict]:
    evidence = []

    # 1. Revert
    if results.get("status") == "REJECTED" and results.get("revert_reason"):
        evidence.append({
            "flag": "revert",
            "label": "Execution Revert",
            "finding": f"Transaction reverted on-chain during simulation: {results.get('revert_reason')}",
            "source": "Isolated EVM simulation",
            "severity": "high"
        })

    # 2. Slippage
    slippage_str = results.get("slippage_detected", "0.00%")
    try:
        slippage = float(slippage_str.replace("%", ""))
        if slippage > 5.0:
            evidence.append({
                "flag": "high_slippage",
                "label": "High Slippage",
                "finding": f"Price slippage of {slippage_str} detected, exceeding 5.0% safety threshold",
                "source": "Token balance tracking inside ephemeral fork",
                "severity": "high"
            })
    except (ValueError, TypeError):
        pass

    # 3. MEV risk
    mev = results.get("timeboost_mev_telemetry") or {}
    if mev.get("sandwich_risk_detected") or mev.get("front_run_risk"):
        risk_score = mev.get("mev_sandwich_risk_score", 0.0)
        evidence.append({
            "flag": "mev_risk",
            "label": "MEV / Frontrun Risk",
            "finding": f"Adversarial frontrun/sandwich risk detected. MEV Risk Score: {risk_score}",
            "source": "DEX routing calldata & gas priority analyzer",
            "severity": "high" if risk_score >= 0.7 else "medium"
        })

    # 4. Gas high
    try:
        # gas_breakdown might contain flag_gas_high or we can compute it
        gas_used = int(results.get("gas_used") or 0)
        gas_limit = int(results.get("gas_limit") or 0)
        if gas_limit and (gas_used / gas_limit) > 0.9:
            evidence.append({
                "flag": "gas_estimate_high",
                "label": "High Gas Cost",
                "finding": f"Gas usage ({gas_used}) exceeds 90% of transaction limit ({gas_limit})",
                "source": "Execution trace gas analysis",
                "severity": "medium"
            })
    except (ValueError, TypeError, ZeroDivisionError):
        pass

    # 5 & 6. Reputation / Unknown Agent
    chain_extras = results.get("chain_extras") or {}
    payee = chain_extras.get("erc8004_payee", "unknown")
    if chain_extras.get("low_agent_reputation"):
        rep_score = chain_extras.get("erc8004_reputation_score", "unknown")
        evidence.append({
            "flag": "low_reputation",
            "label": "Low Payee Reputation",
            "finding": f"Payee address {payee} has low reputation score ({rep_score}) in the registry",
            "source": "ERC-8004 On-chain Reputation Registry",
            "severity": "high"
        })
    if not chain_extras.get("erc8004_is_registered", True):
        evidence.append({
            "flag": "unknown_agent",
            "label": "Unregistered Payee",
            "finding": f"Payee address {payee} is not registered in the reputation contract",
            "source": "ERC-8004 On-chain Reputation Registry",
            "severity": "medium"
        })

    # 7. Price impact
    safety = results.get("safety_checks") or {}
    if safety.get("price_impact_high"):
        evidence.append({
            "flag": "price_impact_high",
            "label": "High Price Impact",
            "finding": "High price impact detected for DEX swap",
            "source": "DEX Pool Reserves Heuristic",
            "severity": "high"
        })

    # 8. Insufficient liquidity
    if safety.get("insufficient_liquidity"):
        evidence.append({
            "flag": "insufficient_liquidity",
            "label": "Insufficient Liquidity",
            "finding": "Target DEX pool has insufficient liquidity for this trade size",
            "source": "DEX Pool Reserves Heuristic",
            "severity": "high"
        })

    # 9. Bridge risk
    if safety.get("bridge_risk"):
        evidence.append({
            "flag": "bridge_risk",
            "label": "Bridge Risk",
            "finding": "Calldata contains calls to untrusted or high-risk bridge contract",
            "source": "Bridge Address Whitelist & Rate Limits",
            "severity": "medium"
        })

    # 10. Oracle manipulation
    if safety.get("oracle_manipulation") or chain_extras.get("oracle_manipulation"):
        evidence.append({
            "flag": "oracle_manipulation",
            "label": "Oracle Price Deviation",
            "finding": "Significant oracle price deviation / manipulation detected",
            "source": "Chainlink Oracle Aggregator Checks",
            "severity": "high"
        })

    # 11. Value transfer
    if safety.get("value_transfer"):
        evidence.append({
            "flag": "value_transfer",
            "label": "High Value Transfer",
            "finding": "Transaction performs high-value transfer of native assets or tokens",
            "source": "Transaction Value Checks",
            "severity": "low"
        })

    # 12. Contract creation
    if safety.get("contract_creation"):
        evidence.append({
            "flag": "contract_creation",
            "label": "Contract Deployment",
            "finding": "Transaction attempts to deploy a new smart contract",
            "source": "EVM Calldata Analyzer",
            "severity": "low"
        })

    return evidence

def get_canonical_evidence_hash(evidence_report: list[dict]) -> str:
    if not evidence_report:
        return "0x" + "0" * 64
    # Sort keys of each item in the list alphabetically
    canonical_list = []
    for item in evidence_report:
        sorted_item = {k: item[k] for k in sorted(item.keys())}
        canonical_list.append(sorted_item)
    # Serialize to compact JSON with sorted keys
    canonical_str = json.dumps(canonical_list, sort_keys=True, separators=(',', ':'))
    return "0x" + keccak(text=canonical_str).hex()
