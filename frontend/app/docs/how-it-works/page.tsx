import Link from 'next/link';
export const metadata = { title: 'How ArbiSim Works — Docs', description: 'A plain-English overview of how ArbiSim Guard simulates transactions before they reach the blockchain.' };
function Step({ n, title, accent, children }: { n: string; title: string; accent: string; children: React.ReactNode }) {
  const colors: Record<string, string> = { coral: 'border-coral/30 bg-coral/5 text-coral', amber: 'border-amber/30 bg-amber/5 text-amber', teal: 'border-teal/30 bg-teal/5 text-teal' };
  return (
    <div className="flex gap-5">
      <div className={`w-10 h-10 rounded-full border flex items-center justify-center flex-shrink-0 font-mono text-sm font-semibold mt-0.5 ${colors[accent]}`}>{n}</div>
      <div className="flex-1 pb-8 border-b border-border last:border-0 last:pb-0">
        <h3 className="text-text-primary font-semibold text-base mb-2">{title}</h3>
        {children}
      </div>
    </div>
  );
}
export default function HowItWorksPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">How It Works</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">How ArbiSim works</h1>
      <p className="text-text-secondary mb-10 leading-relaxed">The complete picture of what happens between "your agent wants to send a transaction" and "safe to proceed".</p>
      <div className="space-y-0 mb-10">
        <Step n="1" title="Your agent has a transaction to send" accent="coral">
          <p className="text-text-secondary text-sm leading-relaxed mb-3">An AI agent — running inside Claude Desktop, a LangGraph graph, an Eliza framework, or your own code — decides it needs to execute an on-chain action. This could be:</p>
          <ul className="space-y-1 text-sm text-text-secondary mb-3">
            {["Swapping tokens on a DEX (e.g. AVAX → USDC on TraderJoe)", "Depositing into a lending protocol (e.g. Aave on Avalanche)", "Paying another agent using the x402 protocol", "Calling any smart contract on an EVM chain"].map(x => <li key={x} className="flex gap-2"><span className="text-coral flex-shrink-0">→</span>{x}</li>)}
          </ul>
          <p className="text-text-secondary text-sm">Before the agent broadcasts anything, it first calls ArbiSim.</p>
        </Step>
        <Step n="2" title="The request reaches the ArbiSim API" accent="amber">
          <p className="text-text-secondary text-sm leading-relaxed mb-3">The request travels through the Cloudflare Worker edge layer, which validates the API key and checks rate limits in under 10ms. Valid requests are written to a Postgres job queue and assigned a job ID.</p>
          <pre className="rounded-lg border border-border bg-surface p-3 text-xs font-mono text-text-secondary overflow-x-auto">{`{
  "network": "avalanche-fuji",
  "agent_address": "0x...",
  "transactions": [{"to": "0x...", "data": "0x..."}],
  "max_slippage_tolerance": 2.0
}`}</pre>
        </Step>
        <Step n="3" title="The Python worker picks it up and forks the chain" accent="teal">
          <p className="text-text-secondary text-sm leading-relaxed mb-3">A Python simulation worker claims the job and uses Foundry Anvil to create an isolated fork of the live blockchain at the current block. This is a complete copy of chain state — real token balances, real liquidity pools, real contract storage.</p>
          <p className="text-text-secondary text-sm leading-relaxed">Crucially, ArbiSim maintains a <strong className="text-text-primary">persistent Anvil process per chain</strong>. Instead of spawning a new process for each simulation (which takes 4+ seconds), it takes an EVM snapshot at the start and reverts to it after each run. This reduces startup latency to under 100ms.</p>
        </Step>
        <Step n="4" title="Your transaction executes in the fork" accent="coral">
          <p className="text-text-secondary text-sm leading-relaxed mb-3">The transaction is submitted to the forked chain via JSON-RPC. The EVM executes it completely — every opcode, every storage write, every token transfer. The execution trace is captured.</p>
          <p className="text-text-secondary text-sm leading-relaxed">No real gas is spent. No money moves. The fork is completely isolated from mainnet.</p>
        </Step>
        <Step n="5" title="The analytical engine runs 10 checks" accent="amber">
          <p className="text-text-secondary text-sm leading-relaxed mb-3">The analytical engine processes the execution trace and runs each safety check independently:</p>
          <div className="grid grid-cols-2 gap-1.5 text-xs font-mono">
            {["Would it revert?", "Price impact?", "MEV sandwich?", "Risky allowance?","Signature valid?", "Permission expired?", "Use priority lane?", "Compute limit?","Trusted counterparty?", "Verified payment?"].map((c, i) => (
              <div key={c} className="flex items-center gap-1.5 text-text-tertiary"><span className="text-teal">✓</span>{i+1}. {c}</div>
            ))}
          </div>
        </Step>
        <Step n="6" title="You get back a structured verdict" accent="teal">
          <p className="text-text-secondary text-sm leading-relaxed mb-3">The result is written back to the database and the gateway responds to the polling request. The agent reads the verdict and acts on it.</p>
          <pre className="rounded-lg border border-border bg-surface p-3 text-xs font-mono text-text-secondary overflow-x-auto">{`{
  "status": "APPROVED",
  "checks": { "would_revert": false, "price_impact_too_high": false, ... },
  "gas_cost": "0.00018 AVAX",
  "verdict": "SAFE — proceed"
}`}</pre>
        </Step>
      </div>
      <div className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-4 mb-8">
        <p className="text-teal text-sm font-medium mb-1">End-to-end latency</p>
        <p className="text-text-secondary text-sm">Median response time is under 400ms on both Avalanche and Arbitrum. This includes RPC fork state reads, execution, and all 10 checks.</p>
      </div>
      <div className="flex gap-4 mt-6">
        <Link href="/docs" className="text-sm text-coral hover:underline">← Introduction</Link>
        <Link href="/docs/what-it-checks" className="text-sm text-coral hover:underline ml-auto">What it checks →</Link>
      </div>
    </article>
  );
}
