import asyncio
import math
import re
from typing import Any

from analytical_brain import AnalyticalBrain
from simulation_engine import AnvilForkInstance

ARBITRUM_BLOCKS_PER_YEAR = 2_000_000


def _parse_usd(value: Any) -> float:
    if isinstance(value, (int, float)):
        return float(value)
    if not isinstance(value, str):
        return 0.0
    cleaned = re.sub(r"[^0-9.+-]", "", value)
    try:
        return float(cleaned)
    except ValueError:
        return 0.0


def _compute_stats(samples: list[dict[str, Any]]) -> dict[str, Any]:
    pnl_series = [float(sample["pnl_usd"]) for sample in samples]
    total = len(samples)
    approved_count = sum(1 for sample in samples if sample.get("status") == "APPROVED")
    rejected_count = total - approved_count

    cumulative = 0.0
    peak = 0.0
    max_drawdown_pct = 0.0
    equity_curve = []
    for sample in samples:
        cumulative += float(sample["pnl_usd"])
        peak = max(peak, cumulative)
        if peak > 0:
            drawdown_pct = ((peak - cumulative) / peak) * 100
            max_drawdown_pct = max(max_drawdown_pct, drawdown_pct)
        equity_curve.append({
            "block": sample["block"],
            "pnl_usd": round(float(sample["pnl_usd"]), 6),
            "cumulative_pnl_usd": round(cumulative, 6),
            "status": sample.get("status", "REJECTED"),
            "gas_cost_eth": sample.get("gas_cost_eth", "0.00000000"),
        })

    mean = sum(pnl_series) / total if total else 0.0
    variance = sum((pnl - mean) ** 2 for pnl in pnl_series) / total if total else 0.0
    std = math.sqrt(variance)
    sharpe_ratio = (mean / std) * math.sqrt(ARBITRUM_BLOCKS_PER_YEAR) if std > 0 else 0.0

    gross_profit = sum(pnl for pnl in pnl_series if pnl > 0)
    gross_loss = abs(sum(pnl for pnl in pnl_series if pnl < 0))
    profit_factor = gross_profit / gross_loss if gross_loss > 0 else (gross_profit if gross_profit > 0 else 0.0)

    return {
        "equity_curve": equity_curve,
        "sharpe_ratio": round(sharpe_ratio, 6),
        "max_drawdown_pct": round(max_drawdown_pct, 4),
        "win_rate": round((approved_count / total) * 100, 4) if total else 0.0,
        "profit_factor": round(profit_factor, 6),
        "total_pnl_usd": round(sum(pnl_series), 6),
        "approved_count": approved_count,
        "rejected_count": rejected_count,
    }


async def run_backtest(record: dict) -> dict:
    strategy = record["strategy"]
    network = record["network"]
    agent_address = record["agent_address"]
    block_start = int(record["block_start"])
    block_end = int(record["block_end"])
    block_stride = int(record.get("block_stride") or 1)
    max_slippage = float(strategy.get("max_slippage", strategy.get("max_slippage_tolerance", 1.0)))
    is_user_op = bool(strategy.get("user_op"))

    samples: list[dict[str, Any]] = []
    for block_number in range(block_start, block_end + 1, block_stride):
        anvil = AnvilForkInstance(network, block_number=block_number)
        try:
            rpc_url = await anvil.start()
            brain = AnalyticalBrain(rpc_url)
            result = await asyncio.get_event_loop().run_in_executor(
                None,
                lambda: brain.execute_simulation(
                    agent_address=agent_address,
                    transactions=[] if is_user_op else strategy.get("transactions", []),
                    max_slippage=max_slippage,
                    user_op=strategy.get("user_op") if is_user_op else None,
                    entrypoint_version=strategy.get("entrypoint_version", "v0.6"),
                ),
            )
            samples.append({
                "block": block_number,
                "pnl_usd": _parse_usd(result.get("net_pnl_usd")),
                "status": result.get("status", "REJECTED"),
                "gas_cost_eth": result.get("gas_cost_eth", "0.00000000"),
            })
        except Exception as err:
            samples.append({
                "block": block_number,
                "pnl_usd": 0.0,
                "status": "REJECTED",
                "gas_cost_eth": "0.00000000",
                "error": str(err),
            })
        finally:
            await anvil.stop()

    return {
        "block_start": block_start,
        "block_end": block_end,
        "block_stride": block_stride,
        "sample_count": len(samples),
        **_compute_stats(samples),
    }
