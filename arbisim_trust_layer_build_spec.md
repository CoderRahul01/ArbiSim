# ArbiSim Guard — Trust Layer Build Spec

## Why this, why now

The recurring pushback on ArbiSim Guard ("isn't this just Tenderly?", "how is this different from wallet checks?") is not a feature gap. It's a trust gap: nobody outside your head can currently verify that a PASS/REJECT verdict is real, consistent, and not just a black box. You already have more of the raw material for fixing this than you think — `SimulationRegistry.sol` already writes every verdict on-chain. The gap is that nobody knows that, and the evidence behind each flag never leaves your analyzers.

This spec does not touch the simulation engine, the analyzers, or the payment flow. It adds a transparency layer on top of what's already running, in three phases sized for a solo founder with weeks of runway.

## What already exists (confirmed in the repo)

- `contracts/SimulationRegistry.sol` (v2, deployed on Arbitrum One + Avalanche C-Chain): every simulation is logged on-chain via `logSimulation()` with a `flagsBitmap` (12 named risk flags), `safeToExecute`, `gasEstimate`, `revertReason`, `chainId`, `timestamp`. `totalSimulations` and `getSessionIds(agent, offset, limit)` are public reads.
- `workers/src/analyzers/base.py`: `SimulationFlags` dataclass already maps 1:1 to the contract's `FLAG_*` constants (revert, high_slippage, mev_risk, gas_estimate_high, low_reputation, unknown_agent, price_impact_high, insufficient_liquidity, bridge_risk, oracle_manipulation, value_transfer, contract_creation).
- `workers/src/chain_registry.py`: `_build_flags()` already derives the bitmap from the internal `results` dict (`slippage_detected`, `timeboost_mev_telemetry`, `chain_extras`, `safety_checks`), and `log_simulation_to_chain()` writes it.

In short: the attestation ledger already exists. It's just invisible and unlabeled. Phase 1 below is almost entirely a read-only frontend feature over data you're already writing.

---

## Phase 1 — Public Trust Dashboard (no contract or backend changes)

**Goal:** a public, no-login page that turns the existing on-chain log into a credibility asset.

Build a new frontend route, e.g. `frontend/app/trust/page.tsx`, that reads directly from `SimulationRegistry.sol` (reuse the RPC endpoints already configured per chain in `chain_config.py`; call from the frontend via `viem`/`ethers` using the existing contract address + a minimal read-only ABI for `totalSimulations`, `getSessionIds`, `getRecord`).

Show:
- **Total simulations run** (live counter, `totalSimulations()`), broken out by chain.
- **Recent verdicts feed**: paginate via `getSessionIds`, resolve each via `getRecord`, decode `flagsBitmap` into human labels (reuse the same bit order as `SimulationFlags.to_bitmap()` — write one canonical decoder and share it between the contract's comments, the API, and the frontend so labels never drift).
- **Catch-rate breakdown**: percentage of verdicts with each flag set, over the last N days. This is the "we caught X sandwich attempts, Y liquidity drains" stat that replaces vague claims with numbers.
- Each row links out to the block explorer (Arbiscan / Snowtrace) for the actual on-chain transaction — this is what makes it verifiable rather than "trust me."

**Design direction:** treat this page like a status/audit page, not a marketing page. Think Etherscan or a SOC 2 trust portal, not a landing page — monospace for hashes and addresses, a plain data table for the feed, a small set of stat cards up top (total runs, catch rate, chains covered). Avoid gradients or hero copy; the credibility comes from the page looking like raw, checkable data.

**Why first:** zero backend changes, zero contract changes, ships in days, and it's the single artifact you can link in the next Ava Labs / grant follow-up instead of describing the product in words.

---

## Phase 2 — Evidence Reports (backend, additive only)

**Goal:** answer "why was this rejected" with specific evidence, without publishing your scoring weights.

1. Add `build_evidence_report(results: dict, flags: SimulationFlags) -> dict` (new file `workers/src/evidence_builder.py`, called from `main.py` right after `analytical_brain.py` returns `results`, alongside the existing `_build_flags()` call in `chain_registry.py`). For each flag that's set, emit one `EvidenceItem`:
   ```json
   {
     "flag": "high_slippage",
     "label": "High slippage",
     "finding": "6.2% price impact detected against $42,000 pool depth",
     "source": "live fork at block 18213xxx, TraderJoe pool 0x...",
     "severity": "high"
   }
   ```
   Pull the concrete numbers straight out of fields you already compute (`slippage_detected`, `timeboost_mev_telemetry`, `chain_extras`, `safety_checks` — same dict `_build_flags()` already reads). No new analysis logic, just a translation layer from internal fields to public-facing sentences.

2. Persist the full evidence report JSON keyed by `session_id` (Postgres, via the existing `db.ts` / `storage.py` connectors — one new table or column is enough, no schema overhaul).

3. New gateway endpoint `GET /api/v1/verdicts/:sessionId/evidence` (add to `gateway/src/routes/agents.ts` or a new `routes/verify.ts`) — public, no auth required, returns the evidence report plus the on-chain `txHash` for cross-reference.

4. **Optional but recommended — contract v3:** add one field, `bytes32 evidenceHash`, to `logSimulation()`, storing `keccak256(canonical evidence JSON)`. This is what turns "we published some evidence" into "this evidence is cryptographically bound to the on-chain record and cannot be edited after the fact." Ship as a new contract (don't touch v2, keep it live for existing records) and switch new writes to v3. This is the actual attestation mechanism — everything else in Phase 2 is presentation.

**What you deliberately do not publish:** the exact thresholds and weighting logic behind `_build_flags()` (e.g. why 5% slippage is the cutoff). That stays private. The rubric in Phase 3 states the categories you check, not the formula.

---

## Phase 3 — Verdict detail page + public methodology page

1. **Verdict detail page** (`frontend/app/trust/[sessionId]/page.tsx`): one evidence card per triggered flag (icon, label, finding, source), a gas/fee breakdown, and a "Verified on-chain" badge linking to the explorer transaction. Once Phase 2's `evidenceHash` ships, add a client-side "Verify" action: refetch the evidence JSON, hash it in the browser, compare to the on-chain `evidenceHash`, show a pass/fail indicator. This is the concrete, demonstrable version of "verifiable without being transparent" — anyone can check it themselves without you showing a line of analyzer code.

2. **Static methodology page** (`frontend/app/methodology/page.tsx` or a docs page): plain-language description of the 12 flag categories (reuse the same names from `SimulationFlags`), one sentence each on what triggers it, and an explicit line: "Exact thresholds are not published to prevent gaming; every individual verdict includes the specific evidence that triggered it, and every verdict is anchored on-chain for independent verification." This single page is what you link the next time someone asks "how is this different from Tenderly."

---

## Suggested build order (given a tight runway)

1. Phase 1 trust dashboard — ships this week, no contract/backend risk, immediately linkable.
2. Phase 2 steps 1–3 (evidence builder + storage + API endpoint) — a few days, backend-only, additive.
3. Phase 3 verdict detail page + methodology page — frontend work reusing Phase 2's API.
4. Phase 2 step 4 (contract v3 + evidenceHash + on-chain verify) — do this once you have a spare cycle for a contract redeploy and testing; it's the most "real" cryptographic claim but the least urgent for the first credible public artifact.

## Explicitly out of scope for this build

No changes to the simulation engine, the analyzers' scoring logic, chain support, payment/billing flows, or the agent stress-test suite. This is a transparency layer on top of what already runs — resist folding in new markets, new chains, or new product lines into this build. Those are separate decisions once the trust layer gives you something concrete to point to.
