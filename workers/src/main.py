import os
import time
import json
import asyncio
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

from simulation_engine import AnvilForkInstance
from analytical_brain import AnalyticalBrain
from storage import save_telemetry

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../..', '.env'))

db_url = os.getenv("NEONDB_URL") or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/arbisim_guard")

def get_db_connection():
    """Establishes connection to PostgreSQL database."""
    return psycopg2.connect(db_url, cursor_factory=RealDictCursor)

def setup_db_tables():
    """Ensures database tables are present (in case gateway didn't start first)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS simulations (
                    session_id UUID PRIMARY KEY,
                    network VARCHAR(50) NOT NULL,
                    agent_address VARCHAR(42) NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    telemetry JSONB,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS simulation_queue (
                    id SERIAL PRIMARY KEY,
                    session_id UUID NOT NULL REFERENCES simulations(session_id) ON DELETE CASCADE,
                    payload JSONB NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
                )
            """)
            conn.commit()
            print("PostgreSQL tables checked/created in worker daemon.")
    except Exception as e:
        conn.rollback()
        print(f"Error checking tables in worker daemon: {e}")
    finally:
        conn.close()

def poll_postgres_queue():
    """
    Polls the local queue using PostgreSQL FOR UPDATE SKIP LOCKED
    to ensure parallel workers can scale safely without collision.
    """
    conn = get_db_connection()
    job = None
    try:
        with conn.cursor() as cur:
            # Query for the next pending job, locking the row and skipping already locked ones
            cur.execute("""
                SELECT id, session_id, payload 
                FROM simulation_queue 
                WHERE status = 'PENDING' 
                ORDER BY created_at ASC 
                LIMIT 1 
                FOR UPDATE SKIP LOCKED;
            """)
            row = cur.fetchone()
            if row:
                job = row
                # Update status to PROCESSING immediately to claim the job
                cur.execute("""
                    UPDATE simulation_queue 
                    SET status = 'PROCESSING', updated_at = NOW() 
                    WHERE id = %s;
                """, (job["id"],))
                conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"PostgreSQL queue polling error: {e}")
    finally:
        conn.close()
    return job

def update_job_status(job_id: int, status: str):
    """Updates the status of the queue job (e.g. COMPLETED, FAILED)."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE simulation_queue 
                SET status = %s, updated_at = NOW() 
                WHERE id = %s;
            """, (status, job_id))
            conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"Failed to update queue job status: {e}")
    finally:
        conn.close()

def update_simulation_db(session_id: str, status: str, telemetry: dict):
    """Updates the global simulation status and telemetry in PostgreSQL."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                UPDATE simulations 
                SET status = %s, telemetry = %s, updated_at = NOW() 
                WHERE session_id = %s;
            """, (status, json.dumps(telemetry), session_id))
            conn.commit()
            print(f"Updated simulation state in PostgreSQL for session {session_id} to {status}")
    except Exception as e:
        conn.rollback()
        print(f"Failed to update simulation state in PostgreSQL: {e}")
    finally:
        conn.close()

async def process_job(job):
    session_id = job["session_id"]
    payload = job["payload"]
    
    network = payload.get("network")
    agent_address = payload.get("agent_address")
    max_slippage = payload.get("max_slippage_tolerance", 1.0)
    
    is_user_op = payload.get("is_user_op", False)
    user_op = payload.get("user_op")
    entrypoint_version = payload.get("entrypoint_version", "v0.6")
    
    print(f"\n[{session_id}] Processing simulation request on network: {network} (UserOperation: {is_user_op})")
    
    anvil_instance = None
    try:
        # 1. Spin up ephemeral Anvil fork
        anvil_instance = AnvilForkInstance(network)
        rpc_url = await anvil_instance.start()
        
        # 2. If it is a UserOperation, run validation check via Gateway
        if is_user_op:
            import requests
            print(f"[{session_id}] Dispatching UserOperation validation check to gateway...")
            try:
                gateway_url = os.getenv("WORKER_GATEWAY_URL", "http://127.0.0.1:3001")
                val_response = requests.post(f"{gateway_url}/api/v1/validate-userop", json={
                    "rpc_url": rpc_url,
                    "user_op": user_op,
                    "entrypoint_version": entrypoint_version,
                    "session_id": session_id
                }, timeout=10)
                
                val_data = val_response.json()
                if not val_data.get("success", True):
                    print(f"[{session_id}] UserOperation validation failed: {val_data.get('reason')}")
                    update_job_status(job["id"], "FAILED")
                    return
            except Exception as val_err:
                print(f"[{session_id}] Validation endpoint query failed: {val_err}. Proceeding with standard execution.")
        
        # 3. Run EVM execution traces, Stylus WASM logic, gas, and P&L calculations
        brain = AnalyticalBrain(rpc_url)
        
        if is_user_op:
            results = brain.execute_simulation(
                agent_address=agent_address,
                transactions=[],
                max_slippage=max_slippage,
                user_op=user_op,
                entrypoint_version=entrypoint_version
            )
        else:
            transactions = payload.get("transactions", [])
            results = brain.execute_simulation(
                agent_address=agent_address,
                transactions=transactions,
                max_slippage=max_slippage
            )
        
        # 4. Save telemetry data to MongoDB (runs conditionally/safely)
        try:
            save_telemetry(
                session_id=session_id,
                status=results["status"],
                gas_cost_eth=results["gas_cost_eth"],
                stylus_ink_consumed=results["stylus_ink_consumed"],
                net_pnl_usd=results["net_pnl_usd"],
                slippage_detected=results["slippage_detected"],
                revert_reason=results["revert_reason"],
                balance_traces=results["balance_traces"],
                token_transfers=results["token_transfers"],
                gas_breakdown=results["gas_breakdown"],
                execution_traces=results["execution_traces"],
                timeboost_mev_telemetry=results.get("timeboost_mev_telemetry")
            )
        except Exception as mongo_err:
            print(f"Warning: Failed to save to MongoDB: {mongo_err}")
        
        # 5. Update core simulation state and telemetry in PG
        final_state = "APPROVED" if results["status"] == "SUCCESS" else "REJECTED"
        update_simulation_db(session_id, final_state, results)
        update_job_status(job["id"], "COMPLETED")
        
    except Exception as err:
        print(f"[{session_id}] Exception during execution: {err}")
        # Build fallback error telemetry
        err_telemetry = {
            "status": "REJECTED",
            "gas_cost_eth": "0.00000000",
            "stylus_ink_consumed": 0,
            "net_pnl_usd": "+0.00",
            "slippage_detected": "0.00%",
            "revert_reason": str(err),
            "balance_traces": [],
            "token_transfers": [],
            "gas_breakdown": {},
            "execution_traces": []
        }
        # Update PG state to REJECTED
        update_simulation_db(session_id, "REJECTED", err_telemetry)
        update_job_status(job["id"], "FAILED")
        
        # Save error details in MongoDB
        try:
            save_telemetry(
                session_id=session_id,
                status="ERROR",
                gas_cost_eth="0.00000000",
                stylus_ink_consumed=0,
                net_pnl_usd="+0.00",
                slippage_detected="0.00%",
                revert_reason=str(err)
            )
        except Exception:
            pass
        
    finally:
        # 6. Clean up Anvil fork process to free up memory & ports
        if anvil_instance:
            await anvil_instance.stop()

async def main_loop():
    print("Starting ArbiSim Guard simulation worker daemon...")
    setup_db_tables()
    
    while True:
        job = poll_postgres_queue()
        if job:
            await process_job(job)
        else:
            # Sleep if no jobs are present
            await asyncio.sleep(1.0)

if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        print("\nStopping worker daemon due to user interrupt.")
