import Link from 'next/link';

export const metadata = { title: 'What is ArbiSim Guard? — Docs', description: 'ArbiSim Guard runs your AI agent transactions in a safe simulation before they touch real money.' };

export default function DocsIntroPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Getting Started</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">What is ArbiSim Guard?</h1>
      <p className="text-text-tertiary text-sm mb-8 font-mono">Last updated: July 2026 · Supported by Ava Labs Retro9000</p>

      <div className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-4 mb-8">
        <p className="text-teal text-sm font-medium mb-1">One sentence</p>
        <p className="text-text-secondary text-sm">Before any transaction goes to the blockchain, ArbiSim Guard runs it first — on a copy of the live chain — and tells your agent whether it is safe to proceed.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface px-5 py-4 mb-8 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div>
          <p className="text-text-primary text-sm font-medium mb-1">New: Circle Agent Stack integration</p>
          <p className="text-text-tertiary text-xs">Circle Agent Wallets get a native pre-flight policy hook, and agents can pay $0.001 USDC per call with x402 Nanopayments — no API key required.</p>
        </div>
        <Link href="/docs/circle" className="shrink-0 text-xs font-medium text-coral hover:underline">Circle docs →</Link>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">The problem it solves</h2>
      <p className="text-text-secondary leading-relaxed mb-4">AI agents are increasingly making financial decisions on their own. They can swap tokens, pay for services, and move funds across chains — all without a human approving each step.</p>
      <p className="text-text-secondary leading-relaxed mb-4">That autonomy is powerful. But it also means there is nothing to catch mistakes before they happen. A bad transaction is sent, it reverts or executes badly, and by the time the agent notices, money has been wasted or lost.</p>
      <p className="text-text-secondary leading-relaxed mb-8">ArbiSim is that catch. It is a mandatory safety check your agent runs <strong className="text-text-primary">before</strong> it sends anything.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">How it works in plain English</h2>
      <div className="space-y-4 mb-8">
        {[
          { n: '1', title: 'Your agent has a plan', body: 'It wants to execute a transaction — a token swap, a DeFi deposit, an agent-to-agent payment.' },
          { n: '2', title: 'It sends that plan to ArbiSim first', body: 'Via a simple API call or an MCP tool call. No blockchain interaction happens yet.' },
          { n: '3', title: 'ArbiSim runs it on a live copy of the chain', body: 'It creates an isolated snapshot of the real blockchain state — real prices, real contracts, real liquidity — and executes your transaction inside that snapshot. Nothing moves.' },
          { n: '4', title: 'You get a verdict', body: 'APPROVED means the transaction looks safe. REJECTED means ArbiSim found a problem, and it tells you exactly what: the transaction would fail, the price impact is too high, someone is trying to front-run you, etc.' },
          { n: '5', title: 'Your agent decides', body: 'If approved, it proceeds. If rejected, it aborts and reports back.' },
        ].map(step => (
          <div key={step.n} className="flex gap-4 p-4 rounded-lg border border-border bg-surface">
            <div className="w-7 h-7 rounded-full border border-coral/40 bg-coral/10 text-coral text-xs font-mono flex items-center justify-center flex-shrink-0 mt-0.5">{step.n}</div>
            <div>
              <p className="text-text-primary text-sm font-medium mb-1">{step.title}</p>
              <p className="text-text-secondary text-sm leading-relaxed">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">Who is this for?</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {[
          { who: 'AI agent developers', what: 'You are building autonomous agents that interact with DeFi protocols. You need a way to validate transactions before they execute in production.' },
          { who: 'DeFi protocol teams', what: 'You want to offer simulation infrastructure to the agent frameworks integrating with your protocol.' },
          { who: 'Blockchain BD / investor reviewers', what: 'You want to see a live, working safety layer with real integrations on Avalanche and Arbitrum.' },
          { who: 'Web3 developers new to agents', what: 'You want to understand what a transaction will do before you run it. ArbiSim explains the result in plain English.' },
        ].map(item => (
          <div key={item.who} className="p-4 rounded-lg border border-border bg-surface">
            <p className="text-text-primary text-sm font-semibold mb-1.5">{item.who}</p>
            <p className="text-text-tertiary text-xs leading-relaxed">{item.what}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">Supported chains</h2>
      <div className="flex flex-wrap gap-2 mb-8">
        {[
          { name: 'Injective EVM Testnet', live: true, featured: true },
          { name: 'Avalanche Fuji (testnet)', live: true, featured: true },
          { name: 'Arbitrum Sepolia (testnet)', live: true, featured: false },
          { name: 'Injective EVM Mainnet', live: false, featured: false },
          { name: 'Avalanche C-Chain', live: false, featured: false },
          { name: 'Arbitrum One', live: false, featured: false },
          { name: 'Base, Polygon, BNB', live: false, featured: false },
        ].map(c => (
          <span key={c.name} className={`text-xs font-mono px-3 py-1.5 rounded-full border ${
            c.featured ? 'border-teal/40 bg-teal/5 text-teal' :
            c.live ? 'border-teal/30 bg-teal/5 text-teal' :
            'border-border text-text-tertiary'
          }`}>
            {c.live ? '✓ ' : '○ '}{c.name}{!c.live && c.name !== 'Base, Polygon, BNB' ? ' (soon)' : ''}
          </span>
        ))}
      </div>
      <p className="text-xs text-text-tertiary mb-8">Avalanche support is funded by the Ava Labs Retro9000 program. Injective support is integrated with the canonical ERC-8004 identity registries.</p>

      <div className="flex gap-4 mt-10 pt-6 border-t border-border">
        <Link href="/docs/quickstart" className="px-5 py-2.5 bg-coral text-white rounded-lg text-sm font-medium hover:bg-coral/90 transition-colors">
          Quickstart (5 min) →
        </Link>
        <Link href="/dashboard/simulate" className="px-5 py-2.5 border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-elevated transition-colors">
          Try it live
        </Link>
      </div>
    </article>
  );
}
