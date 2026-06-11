import os
import json
import asyncio
import asyncpg
from dotenv import load_dotenv

from simulation_engine import AnvilForkInstance
from analytical_brain import AnalyticalBrain
from storage import save_telemetry

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../..', '.env'))

db_url = os.getenv("NEONDB_URL") or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/arbisim_guard")

_pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(db_url, min_size=2, max_size=5)
    return _pool


async def setup_db_tables() -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS simulations (
                session_id UUID PRIMARY KEY,
                network    VARCHAR(50) NOT NULL,
                agent_address VARCHAR(42) NOT NULL,
                status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                telemetry  JSONB,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS simulation_queue (
                id         SERIAL PRIMARY KEY,
                session_id UUID NOT NULL REFERENCES simulations(session_id) ON DELETE CASCADE,
                payload    JSONB NOT NULL,
                status     VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                worker_id  TEXT,
                claimed_at TIMESTAMPTZ,
                finished_at TIMESTAMPTZ,
                visibility_timeout TIMESTAMPTZ,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """)
        # Add columns to existing tables if missing (idempotent)
        for col_sql in [
            "ALTER TABLE simulation_queue ADD COLUMN IF NOT EXISTS worker_id TEXT",
            "ALTER TABLE simulation_queue ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ",
            "ALTER TABLE simulation_queue ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ",
            "ALTER TABLE simulation_queue ADD COLUMN IF NOT EXISTS visibility_timeout TIMESTAMPTZ",
        ]:
            await conn.execute(col_sql)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS simq_status_idx ON simulation_queue (status, created_at ASC)"
        )
    print("PostgreSQL tables checked/created.")


async def poll_and_claim_job() -> dict | None:
    """Atomically claim the next PENDING job using FOR UPDATE SKIP LOCKED."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("""
                UPDATE simulation_queue
                SET status = 'CLAIMED',
                    claimed_at = NOW(),
                    worker_id = $1,
                    visibility_timeout = NOW() + INTERVAL '5 minutes',
                    updated_at = NOW()
                WHERE id = (
                    SELECT id FROM simulation_queue
                    WHERE status = 'PENDING'
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                RETURNING id, session_id, payload
            """, os.uname().nodename)
            return dict(row) if row else None


async def mark_job_done(job_id: int, status: str) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE simulation_queue
            SET status = $1, finished_at = NOW(), updated_at = NOW()
            WHERE id = $2
        """, status, job_id)


async def update_simulation(session_id: str, status: str, telemetry: dict) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE simulations
            SET status = $1, telemetry = $2, updated_at = NOW()
            WHERE session_id = $3
        """, status, json.dumps(telemetry), session_id)
    print(f"Simulation {session_id} → {status}")


async def reclaim_stale_jobs() -> None:
    """Reset CLAIMED jobs whose visibility_timeout has passed back to PENDING."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE simulation_queue
            SET status = 'PENDING', claimed_at = NULL, worker_id = NULL,
                visibility_timeout = NULL, updated_at = NOW()
            WHERE status = 'CLAIMED'
              AND visibility_timeout < NOW()
        """)
    reclaimed = int(result.split()[-1])
    if reclaimed:
        print(f"Reclaimed {reclaimed} stale job(s).")


async def process_job(job: dict) -> None:
    session_id = str(job["session_id"])
    payload    = job["payload"] if isinstance(job["payload"], dict) else json.loads(job["payload"])

    network        = payload.get("network")
    agent_address  = payload.get("agent_address")
    max_slippage   = payload.get("max_slippage_tolerance", 1.0)
    is_user_op     = payload.get("is_user_op", False)
    user_op        = payload.get("user_op")
    ep_version     = payload.get("entrypoint_version", "v0.6")

    print(f"\n[{session_id}] Processing on {network} (UserOp: {is_user_op})")

    anvil = None
    try:
        anvil   = AnvilForkInstance(network)
        rpc_url = await anvil.start()

        # ERC-4337 UserOp validation via gateway
        if is_user_op:
            import aiohttp
            gateway_url = os.getenv("WORKER_GATEWAY_URL", "http://127.0.0.1:3001")
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{gateway_url}/api/v1/validate-userop",
                    json={"rpc_url": rpc_url, "user_op": user_op,
                          "entrypoint_version": ep_version, "session_id": session_id},
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as resp:
                    val = await resp.json()
                    if not val.get("success", True):
                        print(f"[{session_id}] UserOp validation failed: {val.get('reason')}")
                        await mark_job_done(job["id"], "FAILED")
                        return

        brain = AnalyticalBrain(rpc_url)
        transactions = [] if is_user_op else payload.get("transactions", [])

        # Run simulation in a thread to avoid blocking the event loop
        results = await asyncio.get_event_loop().run_in_executor(
            None,
            lambda: brain.execute_simulation(
                agent_address=agent_address,
                transactions=transactions,
                max_slippage=max_slippage,
                user_op=user_op if is_user_op else None,
                entrypoint_version=ep_version
            )
        )

        # Persist telemetry to MongoDB (async)
        try:
            await save_telemetry(
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
                timeboost_mev_telemetry=results.get("timeboost_mev_telemetry"),
            )
        except Exception as mongo_err:
            print(f"[{session_id}] MongoDB write warning: {mongo_err}")

        # Update Neon state — results["status"] is already APPROVED or REJECTED
        await update_simulation(session_id, results["status"], results)
        await mark_job_done(job["id"], "COMPLETED")

    except Exception as err:
        print(f"[{session_id}] Exception: {err}")
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
            "execution_traces": [],
        }
        await update_simulation(session_id, "REJECTED", err_telemetry)
        await mark_job_done(job["id"], "FAILED")
        try:
            await save_telemetry(
                session_id=session_id,
                status="REJECTED",
                gas_cost_eth="0.00000000",
                stylus_ink_consumed=0,
                net_pnl_usd="+0.00",
                slippage_detected="0.00%",
                revert_reason=str(err),
            )
        except Exception:
            pass

    finally:
        if anvil:
            await anvil.stop()


async def main_loop() -> None:
    print("Starting ArbiSim Guard simulation worker daemon...")
    await setup_db_tables()

    reclaim_tick = 0
    while True:
        job = await poll_and_claim_job()
        if job:
            await process_job(job)
        else:
            await asyncio.sleep(1.0)

        # Reclaim stale jobs every 60 seconds
        reclaim_tick += 1
        if reclaim_tick >= 60:
            await reclaim_stale_jobs()
            reclaim_tick = 0


if __name__ == "__main__":
    try:
        asyncio.run(main_loop())
    except KeyboardInterrupt:
        print("\nStopping worker daemon.")
