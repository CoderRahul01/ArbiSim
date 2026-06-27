# ArbiSim Guard - Progress

## Sprint 1-3: Core Infrastructure
- [x] Express gateway on Render (Docker)
- [x] Python Anvil simulation worker (same Docker container)
- [x] Cloudflare Worker proxy (auth, rate limiting, KV)
- [x] NeonDB schema (simulations, queue, api_keys, credits, billing)
- [x] MongoDB telemetry storage
- [x] SIWE auth (WalletConnect + wagmi v2)
- [x] API key system (Argon2id hashing, tier-based quotas)
- [x] Credit system (purchase, earn, consume)
- [x] NOWPayments billing integration
- [x] Simulation Studio (plain-English form, verdict card)
- [x] Simulation permalink (`/sim/{sessionId}`, public, no auth)
- [x] MCP SSE endpoint (`/mcp/sse?api_key=...`)
- [x] Backtest suite
- [x] Webhook callbacks (HMAC-SHA256 signed)
- [x] SimulationRegistry.sol (Solidity contract, deployed testnet)

## Sprint 4: MCP Playground + Billing Alerts
- [x] MCP Playground UI in dashboard
- [x] Credit-based billing with referral codes
- [x] Billing alerts (quota warn/critical banners)
- [x] Dashboard overview with live stats

## Sprint 5: Launch Readiness + Circle Alliance (current)
- [x] Auth persistence fix (7-day JWT, JWT-only gate - no wallet reconnect flash)
- [x] Settings page cleanup (removed gateway endpoint exposure)
- [x] Billing LOADING bug fixed (referral code state init)
- [x] Em dash → hyphen sweep across dashboard
- [x] "Live Simulation" → "Live Sim" nav label
- [x] Circle USDC integration (gateway routes, CF Worker, billing toggle)
- [x] Documentation files (context.md, progress.md, goal.md, memory.md, plan.md)
- [ ] Circle Alliance application submitted
- [ ] Ava Labs mainnet announcement message sent

## Verified Working (as of 2026-06-28)
- Studio simulation: POST to `/api/v1/simulate` → APPROVED/REJECTED verdict in ~8s
- Simulation permalink: `https://arbisimguard.vercel.app/sim/{sessionId}` loads without auth
- CF Worker proxy: `https://arbisim-proxy.rahulpandey-creates.workers.dev/api/v1/stats` returns JSON
- Gateway health: `x-render-origin-server: Render` (Express, not aiohttp)
- MCP config (working):
  ```json
  {
    "mcpServers": {
      "arbisim-guard": {
        "type": "sse",
        "url": "https://arbisim-proxy.rahulpandey-creates.workers.dev/mcp/sse?api_key=YOUR_KEY"
      }
    }
  }
  ```
