import Link from 'next/link';

export const metadata = { title: 'Supported Chains — ArbiSim Guard Docs', description: 'Avalanche and Arbitrum chain-specific configuration and guides for ArbiSim Guard.' };

export default function ChainsPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">How It Works</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Supported chains</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">ArbiSim Guard works across multiple EVM-compatible blockchains. Each chain has its own fork configuration, gas model, and supported features.</p>

      {/* Injective — featured */}
      <div className="rounded-xl border border-[#3B2D7A]/30 bg-[#1B1630]/5 overflow-hidden mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-[#3B2D7A]/20">
          <span className="text-lg">⬡</span>
          <div className="flex-1">
            <h2 className="text-text-primary font-semibold">Injective EVM</h2>
            <p className="text-[#A78BFA] text-xs font-mono">Supported by Injective Canonical ERC-8004 Registry</p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full border border-[#3B2D7A] text-[#A78BFA]">Testnet live</span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">Injective EVM (chain ID 1439) is a Cosmos-compatible EVM chain featuring built-in Frequent Batch Auctions (FBA) at the protocol level for MEV resistance and order-book trading. ArbiSim Guard queries the real on-chain Injective IdentityRegistry and ReputationRegistry, and cross-links safety checks directly with the agent registry.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Testnet network ID', value: '"injective-testnet"' },
              { label: 'Mainnet network ID', value: '"injective-mainnet" (coming soon)' },
              { label: 'Injective Testnet ID', value: '1439' },
              { label: 'Status', value: '✓ Testnet live' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-text-tertiary text-xs">{item.label}</span>
                <code className="text-text-secondary text-xs font-mono">{item.value}</code>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-mono text-text-tertiary mb-2">Example simulation request (Injective Testnet)</p>
            <pre className="text-xs font-mono text-text-secondary overflow-x-auto">{`{
  "network": "injective-testnet",
  "agent_address": "0x...",
  "transactions": [...],
  "max_slippage_tolerance": 0.5
}`}</pre>
          </div>
          <div className="text-xs text-text-tertiary space-y-1">
            <p>Pyth INJ/USD pull oracle feed (ID 0x7a5b...) is configured for price calculations.</p>
            <p>Identity registry checks for ERC-8004 compliance are deterministic across networks.</p>
          </div>
        </div>
      </div>

      {/* Avalanche — featured */}
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 overflow-hidden mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-red-500/20">
          <span className="text-lg">🔴</span>
          <div className="flex-1">
            <h2 className="text-text-primary font-semibold">Avalanche</h2>
            <p className="text-red-400 text-xs font-mono">Supported by Ava Labs · Retro9000 grant program</p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full border border-red-500/30 text-red-400">Featured chain</span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">Avalanche C-Chain is a fully EVM-compatible chain with sub-second finality and low fees. ArbiSim Guard has priority support for Avalanche. Fuji testnet is live now. Mainnet support is coming once the audit is complete.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Testnet network ID', value: '"avalanche-fuji"' },
              { label: 'Mainnet network ID', value: '"avalanche-mainnet" (coming soon)' },
              { label: 'Fuji Chain ID', value: '43113' },
              { label: 'Status', value: '✓ Fuji testnet live' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-text-tertiary text-xs">{item.label}</span>
                <code className="text-text-secondary text-xs font-mono">{item.value}</code>
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-surface p-4">
            <p className="text-xs font-mono text-text-tertiary mb-2">Example simulation request (Avalanche Fuji)</p>
            <pre className="text-xs font-mono text-text-secondary overflow-x-auto">{`{
  "network": "avalanche-fuji",
  "agent_address": "0x...",
  "transactions": [...],
  "max_slippage_tolerance": 2.0
}`}</pre>
          </div>
          <div className="text-xs text-text-tertiary space-y-1">
            <p>TraderJoe, Pangolin, Benqi, and Aave v3 pool addresses are pre-configured for Avalanche.</p>
            <p><a href="https://retro9000.avax.network" target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">Retro9000 grant program ↗</a></p>
          </div>
        </div>
      </div>

      {/* Arbitrum */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <span className="text-lg">🔵</span>
          <div className="flex-1">
            <h2 className="text-text-primary font-semibold">Arbitrum</h2>
            <p className="text-text-tertiary text-xs font-mono">Arbitrum Sepolia testnet · Mainnet coming soon</p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full border border-teal/30 text-teal">Sepolia testnet live</span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">Arbitrum is an L2 rollup on Ethereum. ArbiSim Guard supports Arbitrum Sepolia testnet today. Mainnet support and Arbitrum-specific features (Timeboost, Stylus) are planned for a future release.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Testnet network ID', value: '"arbitrum-sepolia"' },
              { label: 'Mainnet network ID', value: '"arbitrum-one" (coming soon)' },
              { label: 'Sepolia Chain ID', value: '421614' },
              { label: 'Status', value: '✓ Sepolia testnet live' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-text-tertiary text-xs">{item.label}</span>
                <code className="text-text-secondary text-xs font-mono">{item.value}</code>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Coming soon */}
      <div className="rounded-xl border border-border bg-surface/50 p-5 mb-8">
        <p className="text-text-tertiary text-sm font-medium mb-2">Coming soon</p>
        <div className="flex flex-wrap gap-2">
          {['Base', 'BNB Chain', 'Polygon', 'Optimism'].map(chain => (
            <span key={chain} className="text-xs font-mono px-3 py-1 rounded-full border border-border text-text-tertiary">○ {chain}</span>
          ))}
        </div>
        <p className="text-xs text-text-tertiary mt-3">Want a specific chain prioritized? <a href="mailto:hello@arbisimguard.com" className="text-coral hover:underline">Contact us ↗</a></p>
      </div>

      <div className="mt-6 flex gap-4">
        <Link href="/docs/what-it-checks" className="text-sm text-coral hover:underline">← What it checks</Link>
        <Link href="/docs/mcp" className="text-sm text-coral hover:underline ml-auto">MCP integration →</Link>
      </div>
    </article>
  );
}
