# ArbiSim Guard — Architecture

> C4-based HLD/LLD doc set, authored in Mermaid. Diffable in git, renders natively on GitHub and the docs site. **HLD = Context + Container; LLD = Component + sequence diagrams.**

## Document set

| Doc | Purpose | Audience |
|---|---|---|
| [hld.md](./hld.md) | System Context + Container diagrams, deployment topology, trust boundaries, scaling model | Integrators, grant reviewers, you in 6 months |
| [lld.md](./lld.md) | Sequence diagrams, queue state machine, idempotency, rate limits, auth flow, RFC 9457 errors | Engineers integrating against the API/MCP |
| [request-lifecycle.md](./request-lifecycle.md) | The single most important diagram: `202 Accepted → poll for terminal state` | Everyone — the 30-second mental model |
| [mcp/preflight-simulate.md](../mcp/preflight-simulate.md) | The `preflight_simulate` MCP tool contract | Vibekit, Eliza, LangGraph integrators |
| [api/openapi.yaml](../api/openapi.yaml) | OpenAPI 3.1 spec — single source of truth for the REST surface | SDK generators, client authors |
| [errors.md](../errors.md) | RFC 9457 Problem Details taxonomy | Integrators handling failure paths |

## What this is and isn't

This is **doc-as-code for integrators**, not internal design notes. Every diagram has exactly one job: answer a question an integrating developer will have. We do not narrate the codebase; we describe the contract.

## Why C4 + Mermaid

- **C4** (Simon Brown) is the industry-standard zoom model: Context → Container → Component → Code. We use L1 (Context) and L2 (Container) for HLD; L3 (Component) and L4 (Code/sequence) for LLD. This is the only level convention the wider ecosystem recognises.
- **Mermaid** renders in GitHub, Vercel, MDX, most static site generators. Diffable, no binary blobs, no licensing. Authoring cost ~5x lower than PlantUML or draw.io for a solo dev.
