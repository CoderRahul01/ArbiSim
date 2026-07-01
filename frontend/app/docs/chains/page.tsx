import Link from 'next/link';

export const metadata = { title: 'Supported Chains — ArbiSim Guard Docs', description: 'Avalanche and Arbitrum chain-specific configuration and guides for ArbiSim Guard.' };

export default function ChainsPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">How It Works</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Supported chains</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">ArbiSim Guard works across multiple EVM-compatible blockchains. Each chain has its own fork configuration, gas model, and supported features.</p>

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
          <p className="text-text-secondary text-sm leading-relaxed">Avalanche C-Chain is a fully EVM-compatible chain with sub-second finality and low fees. ArbiSim Guard has priority support for Avalanche, with dedicated RPC access provided by Ava Labs through the Retro9000 ecosystem grant program.</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Mainnet network ID', value: '"avalanche-mainnet"' },
              { label: 'Testnet network ID', value: '"avalanche-fuji"' },
              { label: 'Chain ID', value: '43114 (mainnet) / 43113 (Fuji)' },
              { label: 'Status', value: '✓ Live' },
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
            <p>🔴 Avalanche has native support for TraderJoe, Pangolin, Benqi, and Aave v3 pool addresses pre-configured.</p>
            <p>🔴 Chainlink data feeds are monitored for AVAX/USD price and sequencer uptime on Avalanche.</p>
            <p>🔴 <a href="https://retro9000.avax.network" target="_blank" rel="noopener noreferrer" className="text-coral hover:underline">Retro9000 grant program ↗</a></p>
          </div>
        </div>
      </div>

      {/* Arbitrum */}
      <div className="rounded-xl border border-border bg-surface overflow-hidden mb-6">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
          <span className="text-lg">🔵</span>
          <div className="flex-1">
            <h2 className="text-text-primary font-semibold">Arbitrum</h2>
            <p className="text-text-tertiary text-xs font-mono">Arbitrum One + Arbitrum Sepolia testnet</p>
          </div>
          <span className="text-xs font-mono px-2.5 py-1 rounded-full border border-teal/30 text-teal">Live</span>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="text-text-secondary text-sm leading-relaxed">Arbitrum One is an L2 rollup on Ethereum with deep DeFi liquidity. ArbiSim Guard supports Arbitrum-specific features including Timeboost (priority fee lane) and Stylus smart contracts (WASM compute budget tracking).</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: 'Mainnet network ID', value: '"arbitrum-one"' },
              { label: 'Testnet network ID', value: '"arbitrum-sepolia"' },
              { label: 'Chain ID', value: '42161 (mainnet) / 421614 (Sepolia)' },
              { label: 'Timeboost', value: '✓ Supported' },
              { label: 'Stylus (WASM)', value: '✓ Ink tracking' },
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
