import os
import json
import asyncio
import asyncpg
import posthog as _posthog
from aiohttp import web
from dotenv import load_dotenv

from simulation_engine import AnvilForkInstance
from analytical_brain import AnalyticalBrain
from storage import save_telemetry
from chain_registry import log_simulation_to_chain
from chain_config import get_chain
from backtest_runner import run_backtest
from webhook_delivery import deliver_webhook
from stress_test_engine import StressTestSuite

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '../..', '.env'))

_posthog.project_api_key = os.getenv("POSTHOG_API_KEY", "")
_posthog.host = "https://us.i.posthog.com"
_posthog.disabled = not _posthog.project_api_key


def _track(session_id: str, network: str | None, agent_address: str | None, results: dict) -> None:
    if _posthog.disabled:
        return
    try:
        _posthog.capture(
            distinct_id=agent_address or "unknown",
            event="simulation_completed",
            properties={
                "session_id":        session_id,
                "network":           network,
                "status":            results.get("status"),
                "approved":          results.get("status") == "APPROVED",
                "revert_reason":     results.get("revert_reason"),
                "gas_cost_eth":      results.get("gas_cost_eth"),
                "net_pnl_usd":       results.get("net_pnl_usd"),
                "slippage_detected": results.get("slippage_detected"),
                "stylus_ink":        results.get("stylus_ink_consumed", 0),
            },
        )
    except Exception:
        pass

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
        # ── Backtests table (mirrors gateway/src/db.ts schema) ─────────────
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS backtests (
                id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                api_key_id      TEXT,
                network         VARCHAR(50) NOT NULL,
                agent_address   VARCHAR(42) NOT NULL,
                strategy        JSONB NOT NULL,
                block_start     BIGINT NOT NULL,
                block_end       BIGINT NOT NULL,
                block_stride    INTEGER NOT NULL DEFAULT 100,
                status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
                results         JSONB,
                created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        await conn.execute(
            "CREATE INDEX IF NOT EXISTS bt_status_idx ON backtests (status, created_at ASC)"
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
        print(f"Reclaimed {reclaimed} stale simulation job(s).")


# ── Backtest job processing ─────────────────────────────────────────────────

async def poll_and_claim_backtest() -> dict | None:
    """Atomically claim the next PENDING backtest using FOR UPDATE SKIP LOCKED."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("""
                UPDATE backtests
                SET status = 'RUNNING',
                    updated_at = NOW()
                WHERE id = (
                    SELECT id FROM backtests
                    WHERE status = 'PENDING'
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                RETURNING *
            """,)
            return dict(row) if row else None


async def update_backtest(backtest_id: str, status: str, results: dict | None = None) -> None:
    pool = await get_pool()
    async with pool.acquire() as conn:
        if results is not None:
            await conn.execute("""
                UPDATE backtests
                SET status = $1, results = $2, updated_at = NOW()
                WHERE id = $3
            """, status, json.dumps(results), backtest_id)
        else:
            await conn.execute("""
                UPDATE backtests
                SET status = $1, updated_at = NOW()
                WHERE id = $2
            """, status, backtest_id)
    print(f"Backtest {backtest_id} → {status}")


async def reclaim_stale_backtests() -> None:
    """Reset RUNNING backtests older than 30 minutes back to PENDING."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE backtests
            SET status = 'PENDING', updated_at = NOW()
            WHERE status = 'RUNNING'
              AND updated_at < NOW() - INTERVAL '30 minutes'
        """)
    reclaimed = int(result.split()[-1])
    if reclaimed:
        print(f"Reclaimed {reclaimed} stale backtest(s).")


async def process_backtest(record: dict) -> None:
    backtest_id = str(record["id"])
    print(f"\n[BT-{backtest_id[:8]}] Starting backtest: blocks {record['block_start']}..{record['block_end']} stride {record['block_stride']}")

    try:
        results = await run_backtest(record)
        await update_backtest(backtest_id, "COMPLETED", results)
    except Exception as err:
        print(f"[BT-{backtest_id[:8]}] Exception: {err}")
        await update_backtest(backtest_id, "FAILED", {"error": str(err)})


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
    snapshot_id = None
    try:
        anvil   = AnvilForkInstance(network)
        rpc_url = await anvil.start()
        snapshot_id = await anvil.take_snapshot()

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

        chain = get_chain(network)
        brain = AnalyticalBrain(rpc_url, chain_config=chain)
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
        _track(session_id, network, agent_address, results)

        # Deliver webhook asynchronously
        pool = await get_pool()
        await deliver_webhook(session_id, results["status"], results, pool)

        # Write verdict to SimulationRegistry.sol on the simulation chain (non-blocking)
        await log_simulation_to_chain(session_id, results, chain_id=chain.chain_id)

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
        _track(session_id, network, agent_address, err_telemetry)
        
        # Deliver webhook on failure/rejection
        pool = await get_pool()
        await deliver_webhook(session_id, "REJECTED", err_telemetry, pool)

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
            if snapshot_id is not None:
                await anvil.revert_snapshot(snapshot_id)
            await anvil.stop()


async def _ping_handler(request: web.Request) -> web.Response:
    return web.json_response({"status": "ok"})


async def start_ping_server() -> None:
    app = web.Application()
    app.router.add_get('/ping', _ping_handler)
    app.router.add_get('/health', _ping_handler)
    runner = web.AppRunner(app)
    await runner.setup()
    port = int(os.getenv('PING_PORT', '8081'))
    site = web.TCPSite(runner, '0.0.0.0', port)
    await site.start()
    print(f"Ping server listening on :{port}")


async def poll_and_claim_stress_test() -> dict | None:
    """Atomically claim the next pending stress test job."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        async with conn.transaction():
            row = await conn.fetchrow("""
                UPDATE stress_test_queue
                SET status = 'CLAIMED',
                    claimed_at = NOW(),
                    worker_id = $1
                WHERE id = (
                    SELECT id FROM stress_test_queue
                    WHERE status = 'PENDING'
                    ORDER BY created_at ASC
                    FOR UPDATE SKIP LOCKED
                    LIMIT 1
                )
                RETURNING id, stress_test_id, agent_id
            """, os.uname().nodename)
            return dict(row) if row else None


async def reclaim_stale_stress_tests() -> None:
    """Reset CLAIMED stress test jobs that have been running too long."""
    pool = await get_pool()
    async with pool.acquire() as conn:
        result = await conn.execute("""
            UPDATE stress_test_queue
            SET status = 'PENDING', claimed_at = NULL, worker_id = NULL
            WHERE status = 'CLAIMED'
              AND claimed_at < NOW() - INTERVAL '15 minutes'
        """)
    reclaimed = int(result.split()[-1])
    if reclaimed:
        print(f"Reclaimed {reclaimed} stale stress test job(s).")


async def process_stress_test(job: dict) -> None:
    """Runs all 6 stress tests for the claimed agent and writes results to DB."""
    queue_id = job["id"]
    stress_test_id = str(job["stress_test_id"])
    agent_id = str(job["agent_id"])

    pool = await get_pool()
    print(f"[StressTest] Starting suite for agent={agent_id} stress_test={stress_test_id}")

    try:
        # Mark stress test as RUNNING
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE stress_tests SET status = 'RUNNING', updated_at = NOW() WHERE id = $1
            """, stress_test_id)
            await conn.execute("""
                UPDATE agents SET stress_status = 'RUNNING', updated_at = NOW() WHERE id = $1
            """, agent_id)

            # Fetch agent spec
            agent_row = await conn.fetchrow(
                "SELECT spec, network FROM agents WHERE id = $1", agent_id
            )

        if not agent_row:
            raise ValueError(f"Agent {agent_id} not found in DB")

        spec = json.loads(agent_row["spec"]) if isinstance(agent_row["spec"], str) else dict(agent_row["spec"])
        network = agent_row["network"]

        # Run stress suite
        suite = StressTestSuite(network=network, agent_spec=spec, agent_id=agent_id)
        suite_result = await suite.run_full_suite()

        # Serialize results
        results_payload = [
            {
                "test_name": r.test_name,
                "passed": r.passed,
                "verdict": r.verdict,
                "failure_injected": r.failure_injected,
                "duration_ms": r.duration_ms,
                "execution_logs": getattr(r, "execution_logs", []),
                "rpc_calls": getattr(r, "rpc_calls", []),
                "error": r.error,
                "gas_cost_eth": r.simulation_report.get("gas_cost_eth"),
                "net_pnl_usd": r.simulation_report.get("net_pnl_usd"),
                "slippage_detected": r.simulation_report.get("slippage_detected"),
                "revert_reason": r.simulation_report.get("revert_reason"),
                "mev_risk": r.simulation_report.get("timeboost_mev_telemetry", {}).get("mev_sandwich_risk_score"),
            }
            for r in suite_result.results
        ]

        final_status = "PASSED" if suite_result.passed_all else "FAILED"

        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE stress_tests
                SET status = $1, results = $2, passed_all = $3, score = $4, updated_at = NOW()
                WHERE id = $5
            """, final_status, json.dumps(results_payload),
                suite_result.passed_all, suite_result.score, stress_test_id)

            await conn.execute("""
                UPDATE agents SET stress_status = $1, updated_at = NOW() WHERE id = $2
            """, final_status, agent_id)

            await conn.execute("""
                UPDATE stress_test_queue
                SET status = 'DONE', finished_at = NOW()
                WHERE id = $1
            """, queue_id)

        print(f"[StressTest] Done. agent={agent_id} score={suite_result.score} passed={suite_result.passed_all}")

    except Exception as exc:
        print(f"[StressTest] ERROR agent={agent_id}: {exc}")
        async with pool.acquire() as conn:
            await conn.execute("""
                UPDATE stress_tests SET status = 'ERROR', updated_at = NOW() WHERE id = $1
            """, stress_test_id)
            await conn.execute("""
                UPDATE agents SET stress_status = 'ERROR', updated_at = NOW() WHERE id = $1
            """, agent_id)
            await conn.execute("""
                UPDATE stress_test_queue SET status = 'ERROR', finished_at = NOW() WHERE id = $1
            """, queue_id)


async def main_loop() -> None:
    print("Starting ArbiSim Guard simulation worker daemon...")
    await setup_db_tables()

    reclaim_tick = 0
    while True:
        # Priority order: simulation -> backtest -> stress_test
        job = await poll_and_claim_job()
        if job:
            await process_job(job)
        else:
            bt = await poll_and_claim_backtest()
            if bt:
                await process_backtest(bt)
            else:
                # Try stress test queue
                st = await poll_and_claim_stress_test()
                if st:
                    await process_stress_test(st)
                else:
                    await asyncio.sleep(1.0)

        # Reclaim stale jobs every 60 seconds
        reclaim_tick += 1
        if reclaim_tick >= 60:
            await reclaim_stale_jobs()
            await reclaim_stale_backtests()
            await reclaim_stale_stress_tests()
            reclaim_tick = 0


if __name__ == "__main__":
    async def _run() -> None:
        await asyncio.gather(
            start_ping_server(),
            main_loop(),
        )
    try:
        asyncio.run(_run())
    except KeyboardInterrupt:
        print("\nStopping worker daemon.")

