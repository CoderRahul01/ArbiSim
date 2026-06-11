import json
import hmac
import hashlib
import aiohttp
import asyncio
from datetime import datetime
import asyncpg

async def deliver_webhook(session_id: str, status: str, telemetry: dict, pool: asyncpg.Pool) -> None:
    """Fire-and-forget webhook delivery after terminal status."""
    try:
        # 1. Fetch simulation and its owner api_key_id
        async with pool.acquire() as conn:
            sim = await conn.fetchrow(
                "SELECT api_key_id, network, agent_address FROM simulations WHERE session_id = $1",
                session_id
            )
            if not sim or not sim["api_key_id"]:
                print(f"[Webhook] No owner api_key_id found for simulation {session_id}. Skipping webhook delivery.")
                return

            api_key_id = sim["api_key_id"]

            # 2. Fetch active webhooks for this api_key_id
            webhooks = await conn.fetch(
                "SELECT url, secret FROM webhooks WHERE api_key_id = $1 AND active = TRUE",
                api_key_id
            )
            if not webhooks:
                return

            # Construct sanitised telemetry data for payload
            # Slippage mapping
            slippage_pct = telemetry.get("slippage_detected")
            if not slippage_pct and "slippagePercent" in telemetry:
                slippage_pct = f"{telemetry['slippagePercent']}%"

            data_payload = {
                "network": sim["network"],
                "agent_address": sim["agent_address"],
                "gas_cost_eth": telemetry.get("gas_cost_eth") or telemetry.get("gasCostEth"),
                "net_pnl_usd": telemetry.get("net_pnl_usd") or telemetry.get("netPnlUsd"),
                "slippage_detected": slippage_pct,
                "revert_reason": telemetry.get("revert_reason") or telemetry.get("revertReason"),
                "flags": telemetry.get("flags")
            }

            payload = {
                "event": "simulation.completed",
                "session_id": session_id,
                "status": status,
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "data": data_payload
            }

            payload_bytes = json.dumps(payload).encode('utf-8')

            # 3. Deliver to each endpoint asynchronously
            async with aiohttp.ClientSession() as session:
                for hook in webhooks:
                    url = hook["url"]
                    secret = hook["secret"]

                    # Compute HMAC-SHA256 signature
                    signature = hmac.new(
                        secret.encode('utf-8'),
                        payload_bytes,
                        hashlib.sha256
                    ).hexdigest()

                    headers = {
                        "X-ArbiSim-Signature": f"sha256={signature}",
                        "Content-Type": "application/json"
                    }

                    # Delivery task with 1 retry on 5xx and 10s timeout
                    asyncio.create_task(
                        post_webhook_with_retry(session, url, headers, payload_bytes, session_id)
                    )

    except Exception as err:
        print(f"[Webhook] Delivery orchestration error for {session_id}: {err}")

async def post_webhook_with_retry(
    session: aiohttp.ClientSession,
    url: str,
    headers: dict,
    data: bytes,
    session_id: str
) -> None:
    timeout = aiohttp.ClientTimeout(total=10)
    for attempt in [1, 2]:
        try:
            async with session.post(url, headers=headers, data=data, timeout=timeout) as resp:
                if resp.status < 500:
                    # Successful delivery or client-side error (4xx) — do not retry
                    print(f"[Webhook] Delivered {session_id} to {url} with status {resp.status}")
                    return
                else:
                    print(f"[Webhook] Failed delivery of {session_id} to {url} (status {resp.status}), attempt {attempt}")
        except Exception as e:
            print(f"[Webhook] Request failed for {session_id} to {url} (attempt {attempt}): {e}")
        
        if attempt == 1:
            await asyncio.sleep(1.0) # wait 1s before retry
