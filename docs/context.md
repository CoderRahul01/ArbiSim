# ArbiSim Guard - Context

## What It Is

Pre-flight transaction simulation safety layer for AI agents. Before any agent submits a transaction on-chain, ArbiSim Guard forks the chain at the current block, dry-runs the transaction, and returns a safety verdict (APPROVED / REJECTED) with gas estimates, slippage, MEV risk, and revert reasons.

## Stack

| Layer | Tech | Host |
|-------|------|------|
| Frontend | Next.js 15 App Router | Vercel |
| Edge proxy / MCP gateway | Cloudflare Workers (Hono) | Cloudflare |
| REST gateway | Node.js + Express | Render (Docker) |
| Simulation worker | Python 3.11 + Anvil | Render (same Docker container) |
| Structured DB | PostgreSQL (NeonDB) | Neon |
| Telemetry DB | MongoDB Atlas | Atlas |
| Auth | SIWE + wagmi v2 + viem | - |
| Payments | NOWPayments (crypto) + Circle (USDC) | - |

## Services

- **Frontend**: `https://arbisimguard.vercel.app`
- **CF Worker (proxy + MCP)**: `https://arbisim-proxy.rahulpandey-creates.workers.dev`
- **Render gateway + worker**: `https://arbisim-kxik.onrender.com`
- **Cloudflare KV**: stores API key hashes, rate limit counters, JWT nonces, user tiers

## Data Architecture

### NeonDB (PostgreSQL) - structured, relational
- `simulations` - session state (PENDING / APPROVED / REJECTED)
- `simulation_queue` - job queue (FOR UPDATE SKIP LOCKED polling)
- `api_keys` - key prefixes, Argon2id hashes, tiers
- `backtests` - backtest jobs and results
- `webhooks` - user webhook endpoints
- `users` - wallet address, credit balance
- `credit_transactions` - full credit ledger
- `verified_payments` - dedup table (tx_hash, user_address, tier, amount)
- `referral_codes` - referral code registry
- `sim_views` - public permalink view analytics

### MongoDB Atlas - unstructured, append-heavy
- `telemetry` collection - full simulation output (gas traces, token transfers, execution traces, MEV data, balance deltas, revert reasons)

### Cloudflare KV
- `key:{sha256(rawKey)}` - API key hash for fast validation
- `user_tier:{address}` - current user tier (synced from NeonDB on payment)
- `rate:{keyPrefix}:{window}` - sliding window rate limit counters
- `nonce:{uuid}` - SIWE nonce with 5-min TTL

## Auth Flow

1. User connects wallet via AppKit (WalletConnect v2)
2. AppKit triggers SIWE: CF Worker issues a UUID nonce (5-min KV TTL)
3. User signs the EIP-4361 message in their wallet
4. CF Worker verifies signature, issues JWT (7-day expiry), stores in `localStorage`
5. All subsequent requests use JWT as `Authorization: Bearer {jwt}` or `X-API-Key: {jwt}`

## MCP Integration

SSE transport via CF Worker:
```
GET https://arbisim-proxy.rahulpandey-creates.workers.dev/mcp/sse?api_key={key}
```

One tool: `preflight_simulate` - takes network, agent_address, transactions array.

## Supported Networks

| Network | Chain ID | Status |
|---------|----------|--------|
| Arbitrum One | 42161 | Testnet simulation |
| Arbitrum Sepolia | 421614 | Testnet |
| Avalanche C-Chain | 43114 | Testnet simulation |
| Avalanche Fuji | 43113 | Testnet |

## Billing Tiers

| Tier | Monthly sims | DB key |
|------|-------------|--------|
| Free | 500 | `free` |
| Pro | 10,000 | `builder` |
| Enterprise | 100,000 | `protocol` |

Credit packs: 500 ($9), 2,500 ($39), 10,000 ($129) - never expire.
