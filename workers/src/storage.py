import os
from pymongo import MongoClient
from dotenv import load_dotenv
import datetime

load_dotenv()

mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017/arbisim_guard")
db_name = mongo_uri.split("/")[-1].split("?")[0] or "arbisim_guard"

client = None
db = None

def get_mongodb():
    global client, db
    if db is None:
        client = MongoClient(mongo_uri, serverSelectionTimeoutMS=2000)
        # Force connection verification
        client.admin.command('ping')
        db = client[db_name]
    return db

def save_telemetry(
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
):
    """
    Saves complete telemetry results for a session into MongoDB logs cluster
    """
    try:
        db = get_mongodb()
        telemetry_col = db["telemetry"]
        
        document = {
            "session_id": session_id,
            "status": status,
            "gas_cost_eth": gas_cost_eth,
            "stylus_ink_consumed": stylus_ink_consumed,
            "net_pnl_usd": net_pnl_usd,
            "slippage_detected": slippage_detected,
            "revert_reason": revert_reason,
            "balance_traces": balance_traces or [],
            "token_transfers": token_transfers or [],
            "gas_breakdown": gas_breakdown or {},
            "execution_traces": execution_traces or [],
            "timeboost_mev_telemetry": timeboost_mev_telemetry or {},
            "created_at": datetime.datetime.utcnow()
        }
        
        # Overwrite if exists, otherwise insert
        telemetry_col.replace_one({"session_id": session_id}, document, upsert=True)
        print(f"Successfully saved telemetry log in MongoDB for session {session_id}")
    except Exception as e:
        print(f"Warning: MongoDB operation failed: {e}. Telemetry will be stored in PostgreSQL instead.")
