import Link from 'next/link';
export const metadata = { title: 'REST API — ArbiSim Guard Docs', description: 'Complete REST API reference for ArbiSim Guard simulation endpoints.' };
function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-4">
      <div className="px-4 py-2 border-b border-border bg-elevated"><span className="text-xs font-mono text-text-tertiary">{lang}</span></div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}
const BASE = "https://arbisim-proxy.rahulpandey-creates.workers.dev";
export default function RestApiPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Integrations</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">REST API</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">The ArbiSim API is a standard HTTPS JSON API. You can call it from any language, any framework, or directly from <code className="font-mono text-xs text-coral">curl</code>. No SDK required.</p>
      <div className="rounded-lg border border-border bg-surface px-5 py-4 mb-8">
        <p className="text-xs font-mono text-text-tertiary mb-2">Base URL</p>
        <code className="text-sm font-mono text-coral">{BASE}</code>
      </div>
      <h2 className="text-xl font-semibold text-text-primary mt-8 mb-3">Authentication</h2>
      <p className="text-text-secondary text-sm mb-3">Pass your API key in every request using the <code className="font-mono text-xs text-coral">X-API-Key</code> header:</p>
      <CodeBlock lang="bash" code={`curl -H "X-API-Key: ask_free_a1b2_..." ${BASE}/api/v1/simulate`} />
      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">POST /api/v1/simulate</h2>
      <p className="text-text-secondary text-sm mb-3">Run a simulation. Returns a job ID immediately. Poll for the result.</p>
      <CodeBlock lang="bash" code={`curl -X POST ${BASE}/api/v1/simulate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ask_free_a1b2_..." \
  -H "Idempotency-Key: my-unique-op-id" \
  -d '{
    "network": "avalanche-fuji",
    "agent_address": "0x0000000000000000000000000000000000000001",
    "transactions": [
      {
        "to":    "0x60aE616a2155Ee3d9A68541Ba4544862310933d4",
        "data":  "0x38ed1739...",
        "value": "0"
      }
    ],
    "max_slippage_tolerance": 2.0
  }'`} />
      <h3 className="text-base font-semibold text-text-primary mt-6 mb-3">Request body</h3>
      <div className="overflow-x-auto rounded-lg border border-border mb-6">
        <table className="w-full text-xs">
          <thead><tr className="bg-elevated border-b border-border"><th className="px-4 py-3 text-left font-mono text-text-tertiary">Field</th><th className="px-4 py-3 text-left text-text-tertiary">Type</th><th className="px-4 py-3 text-left text-text-tertiary">Required</th><th className="px-4 py-3 text-left text-text-tertiary">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            {[
              ["network","string","✓","Chain to simulate on. See supported values below."],
              ["agent_address","string","✓","The wallet address sending the transactions."],
              ["transactions","array","✓","Array of {to, data, value} objects."],
              ["max_slippage_tolerance","number","—","Price impact limit in %. Default: 2.0"],
              ["block_number","number","—","Fork at a specific block (for backtesting). Default: latest."],
            ].map(([f,t,r,d]) => (
              <tr key={f as string} className="hover:bg-elevated/40">
                <td className="px-4 py-2.5 font-mono text-coral">{f}</td>
                <td className="px-4 py-2.5 text-text-tertiary">{t}</td>
                <td className="px-4 py-2.5 text-center">{r}</td>
                <td className="px-4 py-2.5 text-text-secondary">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-base font-semibold text-text-primary mb-2">Supported network values</h3>
      <div className="flex flex-wrap gap-1.5 mb-8">
        {['"avalanche-mainnet"','"avalanche-fuji"','"arbitrum-one"','"arbitrum-sepolia"'].map(n => (
          <code key={n} className="text-xs font-mono px-2.5 py-1 rounded border border-border bg-surface text-teal">{n}</code>
        ))}
      </div>
      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">GET /api/v1/simulate/:jobId</h2>
      <p className="text-text-secondary text-sm mb-3">Poll for simulation results. Recommended: every 2 seconds, up to 30 attempts.</p>
      <CodeBlock lang="json" code={`{
  "job_id": "8f4a...",
  "status": "APPROVED",
  "checks": {
    "would_revert": false,
    "price_impact_too_high": false,
    "frontrun_detected": false,
    "risky_allowance": false,
    "signature_invalid": false,
    "permission_expired": false,
    "use_priority_lane": false,
    "compute_limit_exceeded": false,
    "untrusted_counterparty": false,
    "payment_unverified": false
  },
  "gas_cost": "0.00021 AVAX",
  "gas_breakdown": { "l2_gas_used": 185420, "total_wei": "213000000000000" },
  "verdict": "SAFE — proceed"
}`} />
      <h3 className="text-base font-semibold text-text-primary mt-6 mb-3">Status values</h3>
      <div className="overflow-x-auto rounded-lg border border-border mb-8">
        <table className="w-full text-xs">
          <thead><tr className="bg-elevated border-b border-border"><th className="px-4 py-3 text-left font-mono text-text-tertiary">Status</th><th className="px-4 py-3 text-left text-text-tertiary">Meaning</th></tr></thead>
          <tbody className="divide-y divide-border">
            {[
              ["PENDING","Job is in the queue, not yet started."],
              ["RUNNING","Simulation is executing in the fork."],
              ["APPROVED","All checks passed. Safe to broadcast."],
              ["REJECTED","One or more checks fired. Read checks object."],
              ["FAILED","Simulation itself could not run. Read error field."],
              ["TIMED_OUT","Took too long. Usually an RPC issue. Retry."],
            ].map(([s,m]) => (
              <tr key={s as string}>
                <td className={`px-4 py-2.5 font-mono ${s === "APPROVED" ? "text-teal" : s === "REJECTED" || s === "FAILED" ? "text-red-400" : "text-text-tertiary"}`}>{s}</td>
                <td className="px-4 py-2.5 text-text-secondary">{m}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex gap-4 mt-6">
        <Link href="/docs/mcp" className="text-sm text-coral hover:underline">← MCP integration</Link>
        <Link href="/docs/frameworks" className="text-sm text-coral hover:underline ml-auto">Frameworks →</Link>
      </div>
    </article>
  );
}
