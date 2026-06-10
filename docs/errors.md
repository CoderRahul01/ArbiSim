# Error Taxonomy — RFC 9457 Problem Details

> All platform errors are returned as [`application/problem+json`](https://www.rfc-editor.org/rfc/rfc9457). Simulation-result flags (e.g. `execution_reverted`, `high_slippage`) are **not** HTTP errors — they are normal results with `status: "REJECTED"`. This page is for the first category.

## Response shape

```json
{
  "type":     "https://docs.arbisimguard.com/errors/rate-limited",
  "title":    "Monthly quota exceeded",
  "status":   429,
  "detail":   "You have used 500 of 500 free-tier simulations this period. Resets 2026-07-01T00:00:00Z.",
  "instance": "/v1/simulations",
  "code":     "quota_exceeded",
  "retry_after": 86400
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `type` | URI | yes | Stable, dereferenceable to a doc page |
| `title` | string | yes | Short human summary |
| `status` | int | yes | Mirrors the HTTP status |
| `detail` | string | no | More specific context |
| `instance` | string | no | The path of the offending request |
| `code` | string | yes (extension) | Stable machine-readable code; preferred for branching |
| `retry_after` | int | no | Seconds. Only on 429. Mirrors the `Retry-After` header. |

> Why RFC 9457? "The new wave of API consumers — think AI bots and models — this challenge only magnifies." A machine-readable `code` field is far easier for an agent to branch on than a free-text message.

---

## Catalog

### `400` — Bad Request

| `code` | When | Detail example |
|---|---|---|
| `invalid_payload` | Request body fails JSON schema validation | `"transactions.0.data: must match pattern ^0x[a-fA-F0-9]*$"` |
| `missing_field` | A required field is absent | `"max_slippage_tolerance is required"` |
| `unsupported_network` | `network` not in enum | `"network 'mainnet' is not supported; use 'arbitrum-one'"` |
| `user_op_version_unsupported` | `user_op.entryPoint` not v0.6 or v0.7 | `"only EntryPoint v0.6 and v0.7 are supported"` |

### `401` — Unauthorized

| `code` | When |
|---|---|
| `missing_api_key` | No `X-API-Key` header |
| `invalid_api_key` | Prefix not found, or argon2id hash mismatch |
| `revoked_api_key` | Key was revoked; rotate immediately |

### `404` — Not Found

| `code` | When |
|---|---|
| `simulation_not_found` | `job_id` does not exist for this API key |
| `backtest_not_found` | Same, for backtests |

### `409` — Conflict

| `code` | When |
|---|---|
| `idempotency_key_mismatch` | `Idempotency-Key` was reused with a *different* request body |

### `429` — Too Many Requests

| `code` | When |
|---|---|
| `quota_exceeded` | Monthly cap hit |
| `rate_limited` | Sustained RPS exceeded |
| `burst_exceeded` | Burst limit exceeded |

All `429` responses include `Retry-After: <seconds>` and `X-RateLimit-*` headers.

### `500` — Internal Server Error

| `code` | When |
|---|---|
| `internal_error` | Unhandled server exception. **Not** the simulation verdict — that's a 200. |
| `fork_spawn_failed` | Could not spawn the Anvil fork (likely host capacity) |
| `rpc_unavailable` | Upstream Arbitrum RPC unreachable |
| `storage_error` | Neon or Mongo write failed |

### `503` — Service Unavailable

| `code` | When |
|---|---|
| `maintenance` | Planned downtime (rare) |
| `capacity_exhausted` | All workers busy; client should back off |

---

## Critical distinction: REJECTED ≠ error

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "job_id": "…",
  "status": "REJECTED",
  "telemetry": {
    "flags": {
      "high_slippage":     true,
      "sandwich_detected": true,
      "execution_reverted": false
    },
    "revert_reason": null,
    "gas_cost_eth": "0.00021"
  }
}
```

The simulation **succeeded**. It told you the truth: "if you send this, you'll get rekt." That is the whole product.

If you write your client to treat any non-2xx as a failure, you will:
- Alert your on-call every time a user tries a legitimately-bad trade.
- Miss the cases where the simulation is most useful.
- Break the dashboard's "REJECTED" badge.

**Rule of thumb for integrators**: if `status` is in `{APPROVED, REJECTED, FAILED, TIMED_OUT}`, parse the result. If the response is `application/problem+json` with an HTTP 4xx/5xx, the platform itself failed.
