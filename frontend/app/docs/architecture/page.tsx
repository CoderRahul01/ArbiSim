import Link from 'next/link';

export const metadata = { title: 'Architecture — ArbiSim Guard Docs', description: 'System architecture overview of ArbiSim Guard — how requests flow from agent to blockchain fork and back.' };

export default function ArchitecturePage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Architecture</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">System overview</h1>
      <p className="text-text-secondary mb-6 leading-relaxed">How ArbiSim Guard is built — four layers from the user&apos;s agent down to the forked blockchain. Each layer has a clear responsibility and a hard boundary.</p>

      {/* Architecture diagrams */}
      <div className="space-y-4 mb-10">
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-elevated flex items-center justify-between">
            <span className="text-xs font-mono text-text-tertiary">High-level architecture</span>
            <span className="text-xs text-text-tertiary">hld.png</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/diagrams/hld.png" alt="ArbiSim Guard high-level architecture" className="w-full" />
        </div>
        <div className="rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border bg-elevated flex items-center justify-between">
            <span className="text-xs font-mono text-text-tertiary">Low-level detail</span>
            <span className="text-xs text-text-tertiary">lld.png</span>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/diagrams/lld.png" alt="ArbiSim Guard low-level architecture" className="w-full" />
        </div>
      </div>

      <div className="space-y-6 mb-10">
        {[
          {
            layer: 'Client',
            components: ['Next.js dashboard (Vercel)', 'Agent frameworks (Vibekit, Eliza, LangGraph)', 'Claude Desktop / Cursor via MCP'],
            protocol: 'HTTPS / MCP stdio',
            role: 'Where the user or their AI agent sends transaction plans to be checked.',
          },
          {
            layer: 'Edge (Cloudflare Worker)',
            components: ['Hono router', 'API key validation', 'Rate limit enforcement (KV store)', 'Request queuing'],
            protocol: 'HTTP → Queue',
            role: 'The first line of defense. Validates the API key, checks rate limits, and forwards valid requests to the application layer. Runs globally with sub-10ms overhead.',
          },
          {
            layer: 'Application (Node.js Gateway)',
            components: ['REST API server (Express + TypeScript)', 'MCP server (stdio or Streamable HTTP)', 'Job queue management', 'Result polling'],
            protocol: 'Postgres queue',
            role: 'The coordination layer. Accepts simulation requests, writes them to the queue, and returns results when the worker completes.',
          },
          {
            layer: 'Data / Worker (Python)',
            components: ['Simulation engine (Anvil fork management)', 'EVM state snapshotting', 'Analytical brain (gas, slippage, MEV detection)', 'Chainlink oracle integration'],
            protocol: 'JSON-RPC (Anvil)',
            role: 'The actual simulation happens here. A persistent Anvil process forks the chain, executes the transaction, and the analytical engine parses the result into a structured safety report.',
          },
        ].map((item, i) => (
          <div key={item.layer} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-elevated/40">
              <span className="w-7 h-7 rounded-lg border border-border bg-base text-xs font-mono text-text-tertiary flex items-center justify-center flex-shrink-0">{i + 1}</span>
              <h3 className="text-text-primary font-semibold text-sm flex-1">{item.layer}</h3>
              <code className="text-xs font-mono text-text-tertiary">{item.protocol}</code>
            </div>
            <div className="px-5 py-4 space-y-3">
              <p className="text-text-secondary text-sm leading-relaxed">{item.role}</p>
              <div className="flex flex-wrap gap-1.5">
                {item.components.map(c => (
                  <span key={c} className="text-xs font-mono px-2.5 py-1 rounded border border-border bg-elevated text-text-tertiary">{c}</span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">Key design decisions</h2>
      <div className="space-y-4 mb-8">
        {[
          { decision: 'Persistent Anvil processes', reason: 'Instead of spawning a new fork for every simulation, ArbiSim keeps a live Anvil process per chain. Each simulation takes a snapshot, runs, then reverts to the snapshot. This reduces latency from ~4 seconds to under 100ms.' },
          { decision: 'Cloudflare Workers at the edge', reason: 'API key validation and rate limiting happen at the edge before any request reaches the origin. This means abuse and invalid requests never consume application resources.' },
          { decision: 'Neon Postgres as the queue', reason: 'Using SELECT FOR UPDATE SKIP LOCKED as a work queue removes the need for a separate message broker (Redis, SQS). Keeps the stack small and deployable on free tiers.' },
          { decision: 'Separate Python worker', reason: 'The simulation engine runs in Python (web3.py + subprocess Anvil). Python was chosen for its mature EVM tooling ecosystem. The Gateway (Node.js) communicates with it via the shared database.' },
        ].map(item => (
          <div key={item.decision} className="flex gap-4 p-4 rounded-lg border border-border bg-surface">
            <div className="w-1.5 flex-shrink-0 rounded-full bg-coral/50 my-1" />
            <div>
              <p className="text-text-primary text-sm font-medium mb-1">{item.decision}</p>
              <p className="text-text-secondary text-sm leading-relaxed">{item.reason}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-4 mb-8">
        <p className="text-text-tertiary text-xs font-mono uppercase tracking-wider mb-2">External dependencies</p>
        <div className="grid sm:grid-cols-2 gap-2 text-xs text-text-secondary">
          {[
            ['Foundry Anvil', 'Local EVM fork engine'],
            ['Neon Postgres', 'Job queue + API key store'],
            ['MongoDB Atlas', 'Telemetry (append-only)'],
            ['Cloudflare KV', 'Rate limit mirror'],
            ['Chainlink', 'AVAX/ETH price oracles'],
            ['Vercel', 'Frontend hosting'],
          ].map(([dep, desc]) => (
            <div key={dep} className="flex justify-between py-1.5 border-b border-border/40">
              <code className="font-mono">{dep}</code>
              <span className="text-text-tertiary">{desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex gap-4">
        <Link href="/docs/frameworks" className="text-sm text-coral hover:underline">← Frameworks</Link>
        <Link href="/docs/data-flow" className="text-sm text-coral hover:underline ml-auto">Request lifecycle →</Link>
      </div>
    </article>
  );
}
