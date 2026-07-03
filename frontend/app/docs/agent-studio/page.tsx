import Link from 'next/link';

export const metadata = {
  title: 'Agent Studio & Stress Testing — ArbiSim Guard Docs',
  description: 'Stress-test AI agents against live Avalanche C-Chain failure scenarios before mainnet deployment.',
};

export default function AgentStudioDocsPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Platform Feature</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Agent Studio & Stress Testing Engine</h1>
      <p className="text-text-tertiary text-sm mb-8 font-mono">Last updated: July 2026 · Native Avalanche C-Chain Support</p>

      <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-5 py-4 mb-8">
        <p className="text-red-400 text-sm font-medium mb-1">What is Agent Studio?</p>
        <p className="text-text-secondary text-sm">
          Agent Studio allows builders to define AI agent specifications, safety gates, and transaction logic.
          Before deploying an agent to Avalanche C-Chain, our engine throws 6 real failure scenarios against live chain state.
          Only agents that pass all 6 parameters get verified for mainnet execution.
        </p>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">The 6 Synthetic Failure Scenarios</h2>
      <div className="space-y-4 mb-8">
        {[
          {
            name: '1. Baseline (Control)',
            desc: 'Executes agent transactions on an unmutated fork at C-Chain head to verify standard execution.',
            pass: 'Must return APPROVED.',
          },
          {
            name: '2. Liquidity Drain',
            desc: 'Over-writes DEX pair reserves storage slots (e.g., slot 8 on TraderJoe V1) to simulate a 70% pool drain.',
            pass: 'Agent must catch high slippage and REJECT.',
          },
          {
            name: '3. Adversarial MEV Sandwich',
            desc: 'Impersonates a MEV bot account and executes a frontrun swap directly before the agent transaction.',
            pass: 'Agent must flag MEV risk > 0.5 and REJECT.',
          },
          {
            name: '4. Oracle Price Crash',
            desc: 'Overrides Chainlink AVAX/USD oracle aggregator storage slot to simulate a 20% price drop.',
            pass: 'Agent must detect price deviation and REJECT.',
          },
          {
            name: '5. Gas Price Spike',
            desc: 'Increases block base fee by 500x (up to 12,500 nAVAX) via anvil_setNextBlockBaseFeePerGas.',
            pass: 'Agent must enforce max_gas_cost_avax limit and REJECT.',
          },
          {
            name: '6. Target Contract Revert',
            desc: 'Replaces target protocol bytecode with minimal REVERT bytecode (0x60006000fd).',
            pass: 'Agent must catch revert reason and REJECT gracefully.',
          },
        ].map((test) => (
          <div key={test.name} className="p-4 rounded-lg border border-border bg-surface">
            <p className="text-text-primary text-sm font-semibold mb-1">{test.name}</p>
            <p className="text-text-secondary text-sm leading-relaxed mb-2">{test.desc}</p>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">
              Pass Gate: {test.pass}
            </span>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">Safety Gate Parameters</h2>
      <div className="p-4 rounded-lg border border-border bg-surface mb-8 space-y-2 text-sm text-text-secondary font-mono">
        <p><strong className="text-text-primary">max_slippage_pct:</strong> Max slippage allowed relative to pre-trade portfolio USD.</p>
        <p><strong className="text-text-primary">max_gas_cost_avax:</strong> Maximum native AVAX fee budget per transaction batch.</p>
        <p><strong className="text-text-primary">min_net_pnl_usd:</strong> Absolute USD floor on net strategy return.</p>
        <p><strong className="text-text-primary">reject_on_mev_risk:</strong> Boolean flag enforcing automatic rejection on sandwich detection.</p>
      </div>

      <div className="flex gap-4 mt-10 pt-6 border-t border-border">
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
