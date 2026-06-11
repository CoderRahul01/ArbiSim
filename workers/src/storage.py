import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/arbisim_guard")
db_name = mongo_uri.split("/")[-1].split("?")[0] or "arbisim_guard"

_client: AsyncIOMotorClient | None = None

def _get_db():
    global _client
    if _client is None:
        _client = AsyncIOMotorClient(mongo_uri, serverSelectionTimeoutMS=5000)
    return _client[db_name]

async def save_telemetry(
    session_id: str,
    status: str,
    gas_cost_eth: str,
    stylus_ink_consumed: int,
    net_pnl_usd: str,
    slippage_detected: str,
    revert_reason: str | None = None,
    balance_traces: list | None = None,
    token_transfers: list | None = None,
    gas_breakdown: dict | None = None,
    execution_traces: list | dict | None = None,
    timeboost_mev_telemetry: dict | None = None
) -> None:
    """Saves complete telemetry for a session into MongoDB (async, upsert)."""
    db = _get_db()
    document = {
        "session_id":              session_id,
        "status":                  status,
        "gas_cost_eth":            gas_cost_eth,
        "stylus_ink_consumed":     stylus_ink_consumed,
        "net_pnl_usd":             net_pnl_usd,
        "slippage_detected":       slippage_detected,
        "revert_reason":           revert_reason,
        "balance_traces":          balance_traces or [],
        "token_transfers":         token_transfers or [],
        "gas_breakdown":           gas_breakdown or {},
        "execution_traces":        execution_traces or [],
        "timeboost_mev_telemetry": timeboost_mev_telemetry or {},
        "created_at":              datetime.now(timezone.utc),
    }
    await db["telemetry"].replace_one(
        {"session_id": session_id}, document, upsert=True
    )
    print(f"Saved telemetry to MongoDB for session {session_id}")
