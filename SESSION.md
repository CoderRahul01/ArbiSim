# ArbiSim Guard — Coding Agent Session

**Project:** ArbiSim Guard — pre-flight simulation layer for AI agents on Arbitrum & Avalanche  
**Branch:** `claude/arbisim-guard-feedback-post-m6fw66`  
**Stack:** Next.js 14 · Cloudflare Workers · Node/Express gateway · Python/Anvil worker · Neon Postgres · PostHog

---

## What was built in this session

### 1. Fixed a silent Vercel deployment failure

The dashboard had been failing to deploy due to three undeclared hook calls in `DashboardLayout` — `isConnected`, `open`, and `disconnect` were used in JSX but never destructured from their wagmi/AppKit hooks. The `open()` call also had a TypeScript type mismatch. Fixed all three, unblocking CI.

**File:** `frontend/app/dashboard/layout.tsx`

---

### 2. Full product analytics stack — PostHog + Vercel Analytics

Wired end-to-end observability from zero:

| Event | Where captured |
|---|---|
| `user_signed_in` | `Providers.tsx` — after SIWE JWT is stored |
| `api_key_created` | `api-keys/page.tsx` — after key creation |
| `simulation_submitted` | `simulate/page.tsx` — on each simulation run |
| `backtest_submitted` | `backtest/page.tsx` — on each backtest run |
| `upgrade_clicked` | `billing/page.tsx` — on plan upgrade click |
| `payment_completed` | Gateway `nowpayments.ts` — after NOWPayments webhook confirms |

PostHog `identify()` is called on sign-in, tying every event to a wallet address. Vercel Analytics handles web traffic separately.

**New files:** `frontend/lib/posthog.ts`  
**Modified:** `frontend/app/layout.tsx`, `Providers.tsx`, 4× dashboard pages, `gateway/src/routes/nowpayments.ts`

---

### 3. NPS survey trigger after simulations

After a user receives their first terminal simulation result (APPROVED or REJECTED) in a session, a 30-second timer fires a PostHog survey render into a fixed overlay. `sessionStorage` prevents it showing twice in one session.

```ts
// fires once per session, 30s after first terminal result
posthog.getActiveMatchingSurveys(surveys => {
  const survey = surveys.find(s => s.name === 'ArbiSim Guard – Simulation usefulness NPS');
  if (!survey) return;
  sessionStorage.setItem('arbisim_survey_shown', '1');
  posthog.renderSurvey(survey.id, '#arbisim-survey-container');
});
```

**File:** `frontend/app/dashboard/simulate/page.tsx`

---

### 4. Removed internal business metrics from the user dashboard

The dashboard was accidentally showing **Total users / Paid users / Revenue (USDC)** to every signed-in user — platform-wide business data that has no place in a user-facing product. Removed the "growth row" entirely. Those metrics already flow to PostHog via server-side events.

**File:** `frontend/app/dashboard/page.tsx`

---

### 5. Recent Simulations widget

Added a `useRecentSims()` hook calling the existing `GET /api/v1/logs?limit=5` endpoint. The card renders the last 5 simulations with:

- **Status badge** — teal `APPROVED` / red `REJECTED`
- **Network** — Arbitrum One, Arbitrum Sepolia, Avalanche C-Chain, etc.
- **Gas cost** — `telemetry.gas_cost_eth` in ETH
- **Net P&L** — `telemetry.net_pnl_usd` in USD (green/red)
- **Relative time** — "5m ago", "2h ago", etc.

Empty state: *"No simulations yet. Run your first one →"*

**File:** `frontend/app/dashboard/page.tsx`

---

### 6. Improved chart empty states

Both the Approval Rate and Gas Cost charts previously showed blank space when a user had no history. Replaced with a dashed-border placeholder and a CTA:

> *"Run a simulation to start seeing trends. Run one now →"*

---

## Commits

```
147fbe0  chore: update tsconfig build info after type check
951557c  fix(dashboard): remove internal growth metrics, add recent sims widget
829afcb  Wire PostHog NPS survey trigger after terminal simulation result
bbc3de6  Fix dashboard layout TypeScript errors causing Vercel build failure
82151e1  Add full product analytics stack (PostHog + Vercel Analytics)
```

---

## Environment variables required

| Variable | Where | Value |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | Vercel | PostHog project API key |
| `NEXT_PUBLIC_POSTHOG_HOST` | Vercel | `https://us.i.posthog.com` |
| `POSTHOG_API_KEY` | Gateway | Same PostHog project API key |

---

## Manual step remaining

In PostHog → Surveys → **"ArbiSim Guard – Simulation usefulness NPS"** → click **Launch** to make the NPS survey live.
