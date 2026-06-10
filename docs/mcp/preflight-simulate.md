# `preflight_simulate` — MCP Tool

> Native Model Context Protocol tool exposed by the ArbiSim Guard MCP server. Conforms to the **MCP 2025-06-18** schema (which added `outputSchema` / `structuredContent`) and the **2025-11-25** revision (which standardised tool name charset and clarified input-error semantics).

The tool is published alongside its REST equivalent (`POST /v1/simulations`) so agent authors can pick their preferred surface. The server returns **both** a text content block (for older clients) and a `structuredContent` object (for clients that validate against `outputSchema`).

---

## Tool definition

```json
{
  "name": "preflight_simulate",
  "title": "Pre-flight Simulation",
  "description": "Submit an ordered batch of EVM transactions (or a single ERC-4337 UserOp) for pre-flight simulation against an ephemeral, block-accurate fork of Arbitrum. The simulation runs in an isolated sandbox and is NEVER broadcast to mainnet. Returns a job_id for polling. Verdict is APPROVED or REJECTED with structured safety flags (reverts, slippage, sandwich risk, MEV, Stylus ink). For autonomous agents that move real capital: do not skip the pre-flight check.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "network": {
        "type": "string",
        "enum": ["arbitrum-one", "arbitrum-sepolia", "robinhood-chain-testnet"],
        "description": "Target chain identifier. arbitrum-one is the default production target."
      },
      "agent_address": {
        "type": "string",
        "pattern": "^0x[a-fA-F0-9]{40}$",
        "description": "Hex EVM address of the agent wallet that would sign the transaction (0x-prefixed, 40 hex chars)."
      },
      "transactions": {
        "type": "array",
        "minItems": 1,
        "items": {
          "type": "object",
          "required": ["to", "data", "value"],
          "properties": {
            "to":       { "type": "string", "pattern": "^0x[a-fA-F0-9]{40}$", "description": "Recipient or contract address (0x-prefixed)." },
            "data":     { "type": "string", "pattern": "^0x[a-fA-F0-9]*$",      "description": "Hex-encoded calldata." },
            "value":    { "type": "string",                                    "description": "Value in wei, as a decimal string (e.g. \"1000000000000000000\" = 1 ETH). Do NOT send as a number." },
            "gasLimit": { "type": "string",                                    "description": "Optional gas limit override, decimal string." }
          }
        },
        "description": "Ordered transactions. Executed in sequence on the fork."
      },
      "user_op": {
        "type": "object",
        "description": "ERC-4337 v0.6 or v0.7 UserOperation. For v0.7 the entryPoint is 0x0000000071727De22E5E9d8BAf0edAc6f37da032. Provide user_op INSTEAD of transactions for AA flows."
      },
      "max_slippage_tolerance": {
        "type": "number",
        "minimum": 0,
        "maximum": 100,
        "description": "Maximum acceptable slippage as a percentage (e.g. 0.5 for 0.5%, 2.0 for 2%). Drives the high_slippage flag threshold."
      }
    },
    "required": ["network", "agent_address", "transactions", "max_slippage_tolerance"]
  },
  "outputSchema": {
    "type": "object",
    "required": ["job_id", "status", "poll_hint"],
    "properties": {
      "job_id":    { "type": "string", "description": "UUID. Use with get_simulation_status to poll for terminal state." },
      "status":    { "type": "string", "const": "PENDING" },
      "poll_hint": { "type": "object", "properties": { "recommended_interval_ms": { "type": "integer", "const": 2000 }, "max_attempts": { "type": "integer", "const": 30 } } }
    }
  },
  "annotations": {
    "readOnlyHint":    true,
    "destructiveHint": false,
    "idempotentHint":  true,
    "openWorldHint":   true
  }
}
```

### Annotations (semantics, per the MCP spec)

| Annotation | Value | Why |
|---|---|---|
| `readOnlyHint` | `true` | The simulation never broadcasts. No state on the live chain is mutated. |
| `destructiveHint` | `false` | Subset of read-only semantics; explicit. |
| `idempotentHint` | `true` | Same inputs → same logical outcome; replays with the same Idempotency-Key return the original `job_id` without re-enqueueing. |
| `openWorldHint` | `true` | The result depends on live chain state (block, liquidity, oracle price). |

> **Caveat for client authors**: per the spec, "Clients MUST consider tool annotations to be untrusted unless they come from trusted servers." ArbiSim is a *hosted, signed* endpoint — the canonical case where the annotation is trustworthy. Local MCP servers cloning this definition are not necessarily so.

---

## Companion tool: `get_simulation_status`

```json
{
  "name": "get_simulation_status",
  "title": "Get Simulation Status",
  "description": "Poll the status of a previously submitted preflight_simulate job. Returns PENDING while the fork is being prepared or the tx is running. Returns APPROVED or REJECTED with full telemetry on terminal state.",
  "inputSchema": {
    "type": "object",
    "required": ["session_id"],
    "properties": {
      "session_id": { "type": "string", "description": "The job_id returned by preflight_simulate (UUID). Also accepts session_id for backward compat." }
    }
  },
  "outputSchema": {
    "type": "object",
    "required": ["session_id", "status"],
    "properties": {
      "session_id": { "type": "string" },
      "status":     { "type": "string", "enum": ["PENDING","CLAIMED","RUNNING","APPROVED","REJECTED","FAILED","TIMED_OUT"] },
      "telemetry":  { "type": "object", "additionalProperties": true }
    }
  },
  "annotations": { "readOnlyHint": true, "openWorldHint": true }
}
```

---

## Transport

- **stdio** — default, used by local agent dev (Claude Desktop, Cursor, Vibekit local). Authenticated by a server-side `ARBI_API_KEY` env var.
- **Streamable HTTP** — for production. Single `/mcp` endpoint, accepts `POST` and `GET`; SSE optional. The 2025-03-26 revision that replaces the deprecated HTTP+SSE transport.

```
POST https://arbisim-proxy.workers.dev/mcp
Authorization: Bearer <api-key>
Content-Type: application/json
```

> "stdio for local dev and Streamable HTTP for production, gated by an environment variable" is the conventional pattern; we follow it.

---

## Error semantics

| Error class | Where it surfaces | Example |
|---|---|---|
| Input validation | Tool result with `isError: true` | Missing `transactions` field |
| Unknown tool name | `McpError(ErrorCode.MethodNotFound, …)` | Calling `preflight_fly` |
| Malformed JSON-RPC | `McpError(ErrorCode.ParseError, …)` | Broken JSON in the request envelope |
| Platform failure (auth, rate limit) | Tool result with `isError: true` + RFC 9457 `application/problem+json` body | Invalid API key, quota exceeded |
| Simulation verdict | **Normal result** — `status: "REJECTED"`, body includes flags | `high_slippage=true` |

Per the 2025-11-25 spec, **input-validation errors are tool-execution errors** (`isError: true`), not protocol errors. This prevents the agent runtime from misclassifying "you sent a bad payload" as a transport-layer problem.

---

## Security note (read this if you embed the tool)

- "Tool poisoning" / "rug pull" attacks (Invariant Labs, 2025) modify tool descriptions on the client side to redirect agent behaviour. The defence: pin the tool's tool-definition hash in your agent config and refuse to call if it changes; and prefer the **hosted** ArbiSim MCP endpoint over a third-party mirror.
- We rate-limit every tool invocation. We validate every input against the JSON schema. We sanitise the text-block output (no script execution in the dashboard's MCP playground; raw text only).

---

## Reference

- [MCP 2025-06-18 schema](https://modelcontextprotocol.io/specification/2025-06-18) — `outputSchema` / `structuredContent` addition.
- [MCP 2025-11-25 schema](https://modelcontextprotocol.io/specification/2025-11-25) — name charset, input-error semantics.
- [Anthropic — Writing effective tools for AI agents](https://www.anthropic.com/engineering/writing-effective-tools-for-ai-agents) — description discipline this spec follows.
- The full request sequence (incl. MCP path) is in [`../architecture/request-lifecycle.md`](../architecture/request-lifecycle.md).
