# ArbiSim Guard — Developer Quickstart

> Five minutes from `npm install` to your first `APPROVED`/`REJECTED` verdict. Or call `preflight_simulate` from your Vibekit/Eliza/LangGraph agent without writing any REST at all.

## 1. Get a free API key

```bash
curl -X POST https://arbisim-proxy.workers.dev/v1/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"my-agent","tier":"free"}'
```

The response includes `secret` — store it immediately. We never show it again.

```json
{
  "id":     "9c2…",
  "prefix": "ask_free_a1b2",
  "tier":   "free",
  "secret": "ask_free_a1b2_<32 random base32 chars>"
}
```

> Use the `Authorization: Bearer <secret>` form for HTTP, or set `ARBI_API_KEY=<secret>` in your env for the MCP server.

## 2. Submit a simulation (REST)

```bash
curl -X POST https://arbisim-proxy.workers.dev/v1/simulations \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ask_free_a1b2_…" \
  -H "Idempotency-Key: order-12345" \
  -d '{
    "network": "arbitrum-one",
    "agent_address": "0x0000000000000000000000000000000000000001",
    "transactions": [
      {
        "to":   "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        "data": "0x38ed1739…",
        "value":"0"
      }
    ],
    "max_slippage_tolerance": 2.0
  }'
```

Response (`202 Accepted`):
```json
{ "job_id": "8f4…", "status": "PENDING", "poll_url": "/v1/simulations/8f4…" }
```

## 3. Poll for the terminal state

```bash
curl https://arbisim-proxy.workers.dev/v1/simulations/8f4… \
  -H "X-API-Key: ask_free_a1b2_…"
```

Terminal response:
```json
{
  "job_id": "8f4…",
  "status": "REJECTED",
  "telemetry": {
    "flags": {
      "high_slippage":         true,
      "sandwich_detected":     true,
      "execution_reverted":    false,
      "timeboost_recommended": true
    },
    "gas_cost_eth": "0.00021",
    "revert_reason": null,
    "gas_breakdown": {
      "l2_gas_used": 185420,
      "l1_buffer":   12800,
      "host_io_penalty_gas": 0,
      "total_wei":   "213000000000000"
    }
  }
}
```

Recommended client behaviour: poll every 2 s with jitter, give up at 30 attempts (~60 s).

## 4. Or call the MCP tool

If you run the ArbiSim MCP server locally (`pnpm --filter gateway dev -- --mcp`), add it to your client config (Claude Desktop, Cursor, etc.):

```json
{
  "mcpServers": {
    "arbisim": {
      "command": "pnpm",
      "args":    ["--filter", "gateway", "dev", "--", "--mcp"],
      "env":     { "ARBI_API_KEY": "ask_free_a1b2_…" }
    }
  }
}
```

Your agent can now do:
> *"Simulate a swap of 0.1 ETH for USDC on Arbitrum and abort if slippage exceeds 2%."*

The tool description is loaded into the agent's context — see [`mcp/preflight-simulate.md`](./mcp/preflight-simulate.md) for the contract.

## 5. The simulation contract

| HTTP | Meaning |
|---|---|
| `200` + `status: PENDING` | Still running. Keep polling. |
| `200` + `status: APPROVED` | All safety flags clean. Safe to broadcast. |
| `200` + `status: REJECTED` | At least one flag fired. Read `telemetry.flags`. |
| `200` + `status: FAILED` / `TIMED_OUT` | The simulation itself could not run. Read `error`. |
| `4xx` / `5xx` + `application/problem+json` | **Platform** error. See [errors.md](./errors.md). |

## What's next

- [Architecture — HLD](./architecture/hld.md)
- [Architecture — LLD](./architecture/lld.md)
- [Request lifecycle — sequence diagrams](./architecture/request-lifecycle.md)
- [`preflight_simulate` MCP spec](./mcp/preflight-simulate.md)
- [Error catalog (RFC 9457)](./errors.md)
- [OpenAPI 3.1 spec](./api/openapi.yaml)
