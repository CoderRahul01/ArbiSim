# ArbiSim Guard - Error Memory

Errors we hit, root causes, and fixes. Read this before debugging production issues.

---

## 1. Port conflict - aiohttp stealing Render PORT from Express

**Symptom:** All `/api/v1/*` calls return `404: Not Found`. Response header shows `x-render-origin-server: Python/3.10 aiohttp/3.14.1`.

**Root cause:** `Dockerfile` `start.sh` hardcoded `PORT=3001 npm start &` for Express. Render injects its own `PORT` env var (typically 10000) for routing. Python's `aiohttp` read `os.getenv('PORT', '8080')` and grabbed Render's PORT, answering all external traffic. Express was alive but unreachable on port 3001.

**Fix:**
- `Dockerfile` `start.sh`: `cd /app/gateway && npm start &` (no PORT override - Express reads Render's PORT)
- `workers/src/main.py`: `port = int(os.getenv('PING_PORT', '8081'))` (off the main port)
- Render env vars: `PORT=3001`, `PING_PORT=8081`

**Commits:** `2ec5ae3`, `156ccc4`

---

## 2. SQL trailing comma - `referral_codes` CREATE TABLE fails

**Symptom:** Express crashes on startup with `error: syntax error at or near ")"` (PostgreSQL error 42601, position 400). `initDb` throws and exits.

**Root cause:** Trailing comma after last column in `CREATE TABLE IF NOT EXISTS referral_codes`:
```sql
active BOOLEAN NOT NULL DEFAULT TRUE,  -- trailing comma before )
```
PostgreSQL parses the full SQL before execution - even `IF NOT EXISTS` doesn't skip the parse.

**Fix:** Remove the trailing comma.  
**File:** `gateway/src/db.ts` line 164  
**Commit:** `e9fec9e`

---

## 3. Wrong CF Worker URL - missing subdomain

**Symptom:** All frontend API calls fail with network errors in production. Correct URL works in `curl`.

**Root cause:** 18 frontend `.tsx`/`.ts` files had fallback URL `'https://arbisim-proxy.workers.dev'` (missing `.rahulpandey-creates` subdomain). The actual worker is at `https://arbisim-proxy.rahulpandey-creates.workers.dev`.

**Fix:** `sed -i '' 's|arbisim-proxy.workers.dev|arbisim-proxy.rahulpandey-creates.workers.dev|g'` across all frontend files. Also set `NEXT_PUBLIC_CF_WORKER_URL` in Vercel env.

---

## 4. wrangler v3 `secret put` fails

**Symptom:** `wrangler secret put RENDER_WORKER_URL` errors: "You attempted to modify a secret, but the latest version of your Worker isn't currently deployed."

**Root cause:** wrangler v3.x has a bug where it refuses to set secrets if the latest worker version isn't in a specific "fully deployed" state.

**Fix:** Upgrade wrangler to v4: `npm install --save-dev wrangler@4` in `cloudflare/package.json`. Then redeploy: `npx wrangler deploy`. Secrets can now be set normally.

---

## 5. Duplicate hook declarations in layout.tsx after merge conflict

**Symptom:** Vercel build fails: `TS2304: Cannot find name 'useAccount'` or duplicate variable declarations.

**Root cause:** PR merge conflict resolution in `frontend/app/dashboard/layout.tsx` resulted in duplicate `const { isConnected } = useAccount()`, `const { open } = useAppKit()`, `const { disconnect } = useDisconnect()` declarations.

**Fix:** Remove the duplicate lines. Also remove unused `quotaUsed`/`quotaLimit` state that was introduced in the same merge.

---

## 6. Render does not allow overriding `PORT` env var via dashboard

**Symptom:** Setting `PORT=3001` in Render environment variables → service restarts but aiohttp still answers. Render routing goes to the old port.

**Root cause:** For Render Docker services, Render may not respect user-overridden `PORT` env var for its external routing. External routing follows what Render detects as the listening port from the EXPOSE directive.

**Fix:** Let Express use Render's injected PORT naturally (no hardcoding in `start.sh`). Use `EXPOSE 10000` in Dockerfile. Use `PING_PORT=8081` env var to move aiohttp off the main port. The correct start.sh: `cd /app/gateway && npm start &` with no PORT override.

---

## 7. Dockerfile - COPY before npm install = slow builds

**Symptom:** Every code push triggers a 15-minute Docker rebuild (Foundry reinstalls every time).

**Root cause:** `COPY . .` appeared before `npm install` and `pip install` in the Dockerfile. Any code change invalidates all subsequent cache layers, forcing full dependency reinstall including Foundry (`foundryup` downloads Anvil, Forge, Cast binaries).

**Fix:** Restructure Dockerfile: install Foundry + deps BEFORE `COPY . .`. Pattern:
1. System deps
2. Foundry (cached)
3. `COPY gateway/package*.json ./` + `npm install` (cached until package.json changes)
4. `COPY workers/requirements.txt ./` + `pip install` (cached)
5. `COPY . .` (only code copy re-runs on code changes)
6. `npm run build`

Result: code-only changes rebuild in ~2 minutes.  
**Commit:** `156ccc4`
