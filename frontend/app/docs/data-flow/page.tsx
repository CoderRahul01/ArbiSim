import Link from 'next/link';
export const metadata = { title: 'Request Lifecycle — ArbiSim Guard Docs', description: 'How a simulation request flows through ArbiSim Guard from API call to verdict.' };
export default function DataFlowPage() {
  const steps = [
    { from: 'Agent / Developer', to: 'Cloudflare Edge', action: 'POST /api/v1/simulate', detail: 'HTTPS request with API key and transaction payload arrives at the nearest Cloudflare data centre.' },
    { from: 'Cloudflare Edge', to: 'Cloudflare KV', action: 'Key lookup', detail: 'The edge Worker reads the API key prefix from KV (< 5ms). KV holds a mirror of tier + rate limit counters for hot-path decisions without a Postgres roundtrip.' },
    { from: 'Cloudflare Edge', to: 'Node Gateway', action: 'Forward valid request', detail: 'If the key is valid and under rate limit, the request is forwarded to the Node.js gateway over HTTPS. Invalid or throttled requests are rejected at the edge with 401 or 429.' },
    { from: 'Node Gateway', to: 'Neon Postgres', action: 'INSERT into simulation_queue', detail: 'The gateway writes the job to Postgres with status=PENDING and returns 202 Accepted + job_id to the caller immediately.' },
    { from: 'Python Worker', to: 'Neon Postgres', action: 'SELECT FOR UPDATE SKIP LOCKED', detail: 'The Python worker polls the queue every 500ms. It claims a job atomically using Postgres advisory locks — multiple workers can run safely without double-claiming.' },
    { from: 'Python Worker', to: 'Anvil (forked chain)', action: 'eth_call / eth_sendTransaction', detail: 'Anvil holds a persistent fork of the target chain. The worker takes an evm_snapshot, executes the transaction batch, then evm_reverts to the snapshot for the next job.' },
    { from: 'Anvil', to: 'Python Worker', action: 'Execution trace + gas', detail: 'Anvil returns the full trace: opcodes, storage changes, events, gas consumed. The analytical engine parses this into the 10 safety check results.' },
    { from: 'Python Worker', to: 'MongoDB', action: 'INSERT telemetry document', detail: 'The full trace and check results are stored append-only in MongoDB for debugging, analytics, and future model training.' },
    { from: 'Python Worker', to: 'Neon Postgres', action: 'UPDATE simulation_queue SET status=APPROVED/REJECTED', detail: "The job status is written back to Postgres. The gateway's polling endpoint will now return the terminal state." },
    { from: 'Developer / Agent', to: 'Node Gateway', action: 'GET /api/v1/simulate/:jobId', detail: 'The caller polls the result endpoint. When status is terminal (APPROVED, REJECTED, FAILED, TIMED_OUT), they get the full verdict and stop polling.' },
  ];
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Architecture</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Request lifecycle</h1>
      <p className="text-text-secondary mb-10 leading-relaxed">What happens, step by step, from the moment your agent sends a simulation request to the moment it gets a verdict.</p>
      <div className="relative mb-10">
        <div className="absolute left-5 top-5 bottom-5 w-px bg-border" />
        <div className="space-y-6">
          {steps.map((step, i) => (
            <div key={i} className="flex gap-5">
              <div className="w-10 h-10 rounded-full border border-coral/30 bg-coral/5 text-coral text-xs font-mono flex items-center justify-center flex-shrink-0 relative z-10">{i + 1}</div>
              <div className="flex-1 rounded-lg border border-border bg-surface p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-xs font-mono text-text-tertiary">{step.from}</span>
                  <span className="text-border">→</span>
                  <span className="text-xs font-mono text-text-tertiary">{step.to}</span>
                  <code className="text-xs font-mono text-coral ml-auto">{step.action}</code>
                </div>
                <p className="text-text-secondary text-sm leading-relaxed">{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        {[
          { label: 'Edge validation', value: '< 10ms', desc: 'API key + rate limit at Cloudflare' },
          { label: 'Fork + execution', value: '< 300ms', desc: 'Snapshot reuse; no cold start' },
          { label: 'End-to-end median', value: '< 400ms', desc: 'Including queue + polling overhead' },
        ].map(s => (
          <div key={s.label} className="rounded-lg border border-border bg-surface p-4 text-center">
            <p className="text-2xl font-mono font-semibold text-coral mb-1">{s.value}</p>
            <p className="text-text-primary text-sm font-medium mb-1">{s.label}</p>
            <p className="text-text-tertiary text-xs">{s.desc}</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4 mt-6">
        <Link href="/docs/architecture" className="text-sm text-coral hover:underline">← Architecture</Link>
        <Link href="/docs/troubleshooting" className="text-sm text-coral hover:underline ml-auto">Troubleshooting →</Link>
      </div>
    </article>
  );
}
