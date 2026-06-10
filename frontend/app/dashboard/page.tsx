import Link from 'next/link';

const STATS = [
  { label: 'Simulations today',     value: '0',       sub: 'no activity yet',         color: 'text-text-primary' },
  { label: 'This month',            value: '0',        sub: '500 free remaining',      color: 'text-text-primary' },
  { label: 'Approval rate',         value: '—',        sub: 'run first simulation',    color: 'text-text-tertiary' },
  { label: 'Avg gas saved',         value: '—',        sub: 'estimate on first run',   color: 'text-text-tertiary' },
];

const CHECKLIST = [
  {
    step: '01',
    title: 'Get your API key',
    description: 'Create a free API key to authenticate simulations from your agent or CLI.',
    href: '/dashboard/api-keys',
    cta: 'Create key →',
    done: false,
  },
  {
    step: '02',
    title: 'Run your first simulation',
    description: 'Paste a transaction payload and click Run — get an APPROVED or REJECTED verdict in seconds.',
    href: '/dashboard/simulate',
    cta: 'Open playground →',
    done: false,
  },
  {
    step: '03',
    title: 'Integrate with your agent',
    description: 'Call preflight_simulate from Vibekit, Eliza, or LangGraph, or hit the REST endpoint directly.',
    href: 'https://github.com/arbisim-guard/docs',
    cta: 'View docs →',
    done: false,
    external: true,
  },
];

const NETWORK_STATUS = [
  { name: 'Arbitrum One',          rpc: 'arb-mainnet.g.alchemy.com', status: 'operational' },
  { name: 'Arbitrum Sepolia',      rpc: 'arb-sepolia.g.alchemy.com',  status: 'operational' },
  { name: 'Simulation Engine',     rpc: 'Python Anvil worker',        status: 'operational' },
  { name: 'Gateway API',           rpc: 'Node / Express',             status: 'operational' },
];

export default function DashboardOverview() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Page header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-text-primary">Overview</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal animate-pulse-dot" />
            <span className="text-xs text-text-tertiary">All systems operational</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-5xl w-full mx-auto">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {STATS.map(s => (
            <div key={s.label} className="p-5 rounded-xl border border-border bg-surface hover:bg-elevated transition-colors duration-200">
              <p className="text-xs text-text-tertiary mb-2 font-mono">{s.label}</p>
              <p className={`text-2xl font-semibold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-tertiary mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Onboarding */}
          <div className="md:col-span-2 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Get started</h2>
              <span className="text-xs font-mono text-text-tertiary">0 / 3 complete</span>
            </div>
            <div className="divide-y divide-border">
              {CHECKLIST.map((item, i) => (
                <div key={i} className="px-6 py-5 flex gap-4 group">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 text-xs font-mono font-semibold transition-colors ${
                    item.done
                      ? 'bg-teal/10 border-teal/30 text-teal'
                      : 'bg-elevated border-border text-text-tertiary'
                  }`}>
                    {item.done ? '✓' : item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium mb-1 ${item.done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-text-tertiary leading-relaxed mb-3">{item.description}</p>
                    {item.external ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-coral hover:text-coral-hover transition-colors">
                        {item.cta}
                      </a>
                    ) : (
                      <Link href={item.href} className="text-xs font-medium text-coral hover:text-coral-hover transition-colors">
                        {item.cta}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: System status */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-text-primary">System status</h2>
              </div>
              <div className="divide-y divide-border">
                {NETWORK_STATUS.map(n => (
                  <div key={n.name} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-text-primary">{n.name}</p>
                      <p className="text-xs text-text-tertiary font-mono">{n.rpc}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                      <span className="text-xs text-teal">up</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-text-primary">Quick actions</h2>
              </div>
              <div className="p-3 space-y-2">
                <Link href="/dashboard/simulate"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated border border-transparent hover:border-border transition-all duration-150 group">
                  <div className="w-7 h-7 rounded-md bg-coral/10 border border-coral/20 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-coral">
                      <polygon points="3,2 13,8 3,14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Run a simulation</p>
                    <p className="text-xs text-text-tertiary">Test any transaction</p>
                  </div>
                </Link>
                <Link href="/dashboard/api-keys"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated border border-transparent hover:border-border transition-all duration-150 group">
                  <div className="w-7 h-7 rounded-md bg-amber/10 border border-amber/20 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-amber">
                      <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8.5 8.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Create API key</p>
                    <p className="text-xs text-text-tertiary">Self-serve access</p>
                  </div>
                </Link>
                <Link href="/dashboard/billing"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated border border-transparent hover:border-border transition-all duration-150 group">
                  <div className="w-7 h-7 rounded-md bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-teal">
                      <rect x="1" y="3.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Manage plan</p>
                    <p className="text-xs text-text-tertiary">Free · 500 sims/mo</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* MCP tool callout */}
        <div className="mt-6 rounded-xl border border-coral/20 bg-coral/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 px-2 py-0.5 rounded">MCP</span>
                <h3 className="text-sm font-semibold text-text-primary">preflight_simulate — native MCP tool</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed max-w-xl">
                Call ArbiSim Guard directly from Vibekit, Eliza, or LangGraph using the Model Context Protocol.
                No REST integration needed — your agent calls <code className="font-mono text-coral">preflight_simulate</code> and gets a structured APPROVED/REJECTED verdict.
              </p>
            </div>
            <a href="https://github.com/arbisim-guard/docs/mcp" target="_blank" rel="noopener noreferrer"
              className="shrink-0 px-4 py-2 rounded-lg border border-coral/30 bg-coral/10 text-coral text-xs font-medium hover:bg-coral/20 transition-colors whitespace-nowrap">
              View MCP docs →
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
