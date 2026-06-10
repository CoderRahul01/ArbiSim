# ArbiSim Guard

> Pre-flight simulation for AI agents on Arbitrum. Run transactions and ERC-4337 UserOps inside an ephemeral, block-accurate Anvil fork before they reach mainnet. Approve, reject, or refuse — without spending a wei.

## Quickstart

See [`docs/quickstart.md`](./docs/quickstart.md) for a 5-minute walkthrough (REST + MCP).

## Architecture

The full doc set lives in [`docs/`](./docs/):

- [**HLD**](./docs/architecture/hld.md) — C4 Context + Container, deployment topology, trust boundaries, scaling model.
- [**LLD**](./docs/architecture/lld.md) — Data model, queue state machine, idempotency, rate limits, auth flow.
- [**Request lifecycle**](./docs/architecture/request-lifecycle.md) — Sequence diagrams: 202→poll, UserOp, MCP, error/reclaim.
- [**MCP tool**](./docs/mcp/preflight-simulate.md) — `preflight_simulate` contract for Vibekit/Eliza/LangGraph.
- [**OpenAPI 3.1**](./docs/api/openapi.yaml) — REST surface, single source of truth for SDK generation.
- [**Error catalog**](./docs/errors.md) — RFC 9457 Problem Details, the `REJECTED ≠ error` rule.

## Repo layout

```
arbisim-guard/
├── frontend/   Next.js App Router dashboard (Vercel)
├── cloudflare/ Edge Worker (authn, KV rate-limit, hot tier lookup)
├── gateway/    Node + Express REST + MCP server
├── workers/    Python 3.11 worker daemon (Anvil fork orchestrator)
├── contracts/  (planned) Stylus helpers, none deployed yet
├── docs/       This doc set (C4, Mermaid, OpenAPI 3.1, RFC 9457)
├── demo_agent.ts
├── test_simulation.py
└── test_userop_simulation.py
```

## Status

Phase 1: live simulation working. Dashboard, MCP server, and Python worker are operational. Backtesting engine and the Simulation Explorer are next — see the project plan.
