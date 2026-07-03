import Link from 'next/link';

export const metadata = {
  title: 'Agent Studio & Developer Integration Guide — ArbiSim Guard Docs',
  description: 'Learn how to build error-free AI agents on Avalanche C-Chain, run synthetic failure testing, and enforce pre-flight safety gates.',
};

export default function AgentStudioDocsPage() {
  return (
    <article className="prose prose-invert max-w-none space-y-8">
      <div>
        <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Platform Feature & Developer Guide</div>
        <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Agent Studio & Integration Guide</h1>
        <p className="text-text-tertiary text-sm font-mono">Last updated: July 2026 · Native Avalanche C-Chain Support</p>
      </div>

      <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-5 py-4">
        <p className="text-red-400 text-sm font-medium mb-1">What is Agent Studio?</p>
        <p className="text-text-secondary text-sm leading-relaxed">
          Agent Studio allows developers to define AI agent specifications, expected DeFi transactions, and safety gates.
          Before an agent executes live on Avalanche C-Chain, our engine throws 6 real failure scenarios against live chain state.
          Only agents that pass all 6 parameters get verified for mainnet execution.
        </p>
      </div>

      {/* Section 1: How it Works */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-3">How AI Agent Safety Enforcement Works</h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-4">
          Post-execution monitors only alert you after capital is lost. ArbiSim Guard works as a <strong className="text-text-primary">pre-flight gate</strong>:
        </p>

        <div className="p-4 rounded-xl border border-border bg-surface font-mono text-xs space-y-2 text-text-secondary">
          <p className="text-coral">1. Agent generates DeFi transaction payload (swap, borrow, yield deposit)</p>
          <p className="text-text-tertiary">2. Agent passes payload to AgentRunner.execute_action(txs)</p>
          <p className="text-text-tertiary">3. ArbiSim Guard forks Avalanche C-Chain head in 180ms Anvil instance</p>
          <p className="text-text-tertiary">4. Evaluates 5 safety gates (Slippage, Gas Cap, Net P&L Floor, MEV Risk, Revert)</p>
          <p className="text-teal font-semibold">5. Returns cleared_for_broadcast = True ONLY if all parameters pass</p>
        </div>
      </div>

      {/* Section 2: 6 Synthetic Failure Scenarios */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-3">The 6 Synthetic Failure Scenarios</h2>
        <div className="grid grid-cols-1 gap-3">
          {[
            {
              name: '1. Baseline (Control)',
              desc: 'Executes agent transactions on an unmutated fork at C-Chain head with 100 AVAX auto-funded balance.',
              pass: 'Must return APPROVED with zero EVM reverts.',
            },
            {
              name: '2. Liquidity Drain',
              desc: 'Overrides DEX pair reserves storage slot 8 via anvil_setStorageAt to simulate a 70% pool liquidity drain.',
              pass: 'Agent must detect slippage > max_slippage_pct and return REJECTED.',
            },
            {
              name: '3. Adversarial MEV Sandwich',
              desc: 'Impersonates a MEV bot account and executes a frontrun swap directly before the agent transaction.',
              pass: 'Agent must flag MEV risk > 0.5 and return REJECTED.',
            },
            {
              name: '4. Oracle Price Crash',
              desc: 'Overrides Chainlink AVAX/USD oracle aggregator storage slot 3 to simulate a 20% price drop.',
              pass: 'Agent must detect price deviation and return REJECTED.',
            },
            {
              name: '5. Gas Price Spike',
              desc: 'Increases block base fee by 500x (up to 12,500 nAVAX) via anvil_setNextBlockBaseFeePerGas.',
              pass: 'Agent must enforce max_gas_cost_avax limit and return REJECTED.',
            },
            {
              name: '6. Target Contract Revert',
              desc: 'Replaces target protocol bytecode with minimal REVERT bytecode (0x60006000fd).',
              pass: 'Agent must catch EVM revert reason and return REJECTED gracefully.',
            },
          ].map((test) => (
            <div key={test.name} className="p-4 rounded-lg border border-border bg-surface">
              <p className="text-text-primary text-sm font-semibold mb-1">{test.name}</p>
              <p className="text-text-secondary text-xs leading-relaxed mb-2">{test.desc}</p>
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
                Pass Gate: {test.pass}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Creating Error-Free Agent Specs */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-3">Creating Error-Free Agent Specifications</h2>
        <p className="text-text-secondary text-sm leading-relaxed mb-3">
          To ensure your baseline control test passes without EVM reverts, follow these best practices when building agent calldata:
        </p>

        <div className="space-y-3 text-xs font-mono text-text-secondary">
          <div className="p-3 rounded-lg border border-border bg-surface">
            <strong className="text-text-primary block mb-1">1. Set Future Router Deadlines</strong>
            <p className="text-text-tertiary">When calling DEX routers (TraderJoe, Pangolin), set deadline = 0xffffffff or Math.floor(Date.now() / 1000) + 3600. Setting deadline = 0 will cause EVM revert: TraderJoeRouter: EXPIRED.</p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-surface">
            <strong className="text-text-primary block mb-1">2. Target Contract Hex Encoding</strong>
            <p className="text-text-tertiary">Ensure to address is a valid 0x 40-character checksummed address (e.g. 0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7 for WAVAX).</p>
          </div>

          <div className="p-3 rounded-lg border border-border bg-surface">
            <strong className="text-text-primary block mb-1">3. Native AVAX Value vs Token Approvals</strong>
            <p className="text-text-tertiary">For native AVAX swaps or deposits, set value in wei (e.g. 100000000000000000 = 0.1 AVAX). For ERC-20 token swaps, include an approve(router, amount) transaction first in the transaction array.</p>
          </div>
        </div>
      </div>

      {/* Section 4: Python / Node SDK Integration */}
      <div>
        <h2 className="text-xl font-semibold text-text-primary mb-3">3-Line SDK Integration Code</h2>

        <div className="p-4 rounded-xl border border-border bg-slate-950 font-mono text-xs space-y-2 text-slate-300 overflow-x-auto">
          <p className="text-slate-500"># Python Integration (Vibekit, Eliza, LangGraph)</p>
          <p className="text-coral">from agent_runner import AgentRunner</p>
          <p>runner = AgentRunner(agent_spec)</p>
          <p className="text-teal">report = await runner.execute_action(transactions)</p>
          <p className="text-amber-300">if report["cleared_for_broadcast"]:</p>
          <p className="pl-4 text-emerald-400">broadcast_to_avalanche_mainnet(transactions)</p>
          <p className="text-amber-300">else:</p>
          <p className="pl-4 text-rose-400">logger.warn(f"Pre-flight safety gate rejected: {'{report[\'gate_reason\']}'}")</p>
        </div>
      </div>

      {/* Action CTA */}
      <div className="flex gap-4 mt-8 pt-6 border-t border-border">
        <Link href="/dashboard/agents/new" className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-500 transition-colors">
          Create Agent in Studio →
        </Link>
        <Link href="/docs/rest-api" className="px-5 py-2.5 border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-elevated transition-colors">
          View REST API Spec
        </Link>
      </div>
    </article>
  );
}
