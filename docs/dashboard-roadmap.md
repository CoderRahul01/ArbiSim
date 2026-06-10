# Dashboard Roadmap — ArbiSim Guard

The roadmap is sequenced by **activation → retention → grant credibility**.

## NOW (Activation — Weeks 1–3)
*Focus: Time-to-first-call and self-serve onboarding.*

- **API Key Management:** Create, name, rotate, and revoke keys. Keys use prefixes (e.g., `ask_free_a1b2`) with Argon2id hashes stored in Neon Postgres and hot-path KV caching in Cloudflare.
- **Usage Analytics & Quota Meter:** Track requests, success/reject rates, and remaining quota against the ~500/month free cap.
- **Onboarding Checklist:** "Create key → Run first simulation → Call from your agent."
- **Billing:** Tier displays and Stripe upgrade CTAs (Free $0 / Pro $29 / Enterprise $299).

## NEXT (Retention & Grant Credibility — Weeks 3–8)
*Focus: The "never existed before" agent-centric tools that align with Arbitrum Foundation grants.*

- **★ Regression-Style Backtesting Suite (Grant Priority):** Replay a strategy across a historical Arbitrum block range through the pre-flight engine. Outputs P&L, Sharpe ratio, max drawdown, win rate, and profit factor. (Directly addresses the Foundation's call for "backtesting systems... or P&L calculators").
- **★ Simulation Explorer:** Visual EVM trace explorer per job. Shows per-opcode/per-step gas, L1+L2 gas split, decoded ERC-20 transfers, balance diffs, and exact flags triggered.
- **★ Shareable Simulation Permalink:** A public, read-only URL and signed JSON receipt for every simulation. Acts as an audit trail for agents.
- **Request Logs:** Searchable log of every API call with one-click re-run capabilities.
- **Risk Analytics Dashboard:** Sharpe/drawdown/P&L charts across simulation history.

## LATER (Scale — Post-Buildathon)
*Focus: Enterprise readiness and protocol integration.*

- **Webhooks:** Register endpoints and HMAC signing secrets for terminal state delivery (eliminates polling).
- **Team Management:** Org-level members, roles, and shared API keys.
- **In-Browser MCP Playground:** Call `preflight_simulate` directly from the dashboard to demonstrate I/O to agent devs.
- **Status Alerts:** Notifications for anomalous reject spikes or quota exhaustion.
