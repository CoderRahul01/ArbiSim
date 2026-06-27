# ArbiSim Guard - Sprint 5 Plan

## Status: In Progress

## Tasks

| # | Task | Status | Files |
|---|------|--------|-------|
| 1 | Auth persistence (7-day JWT, JWT-only gate) | Done | `cloudflare/src/index.ts`, `frontend/app/dashboard/layout.tsx` |
| 2 | Settings - remove gateway endpoint section | Done | `frontend/app/dashboard/settings/page.tsx` |
| 3 | Billing - fix LOADING referral bug | Done | `frontend/app/dashboard/billing/page.tsx` |
| 4 | Em dash sweep + "Live Sim" nav label | Done | Multiple dashboard files |
| 5 | Circle USDC gateway routes | Done | `gateway/src/routes/circle.ts`, `gateway/src/services/circle.ts`, `gateway/src/routes/admin.ts`, `gateway/src/index.ts` |
| 6 | Circle USDC billing toggle (frontend) | Done | `frontend/app/dashboard/billing/page.tsx` |
| 7 | Documentation files | Done | `docs/*.md` |
| 8 | Push + deploy | Pending | - |
| 9 | Set CIRCLE_API_KEY + CIRCLE_WEBHOOK_SECRET in Render | Pending | Render env vars |
| 10 | Circle Alliance application | Pending | developer.circle.com/alliance |

## After This Sprint

- Deploy SimulationRegistry.sol to Arbitrum One mainnet (~$1-2 ETH gas)
- Deploy SimulationRegistry.sol to Avalanche C-Chain mainnet (~0.05 AVAX)
- Send Ava Labs mainnet announcement message
- Apply to Arbitrum Audit Program
- Add x402 micropayment simulation support (for Circle Alliance roadmap story)
