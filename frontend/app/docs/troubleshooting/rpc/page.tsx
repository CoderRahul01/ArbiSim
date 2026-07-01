import Link from 'next/link';
export const metadata = { title: 'RPC & Fork Issues — ArbiSim Guard Docs', description: 'Fix RPC connection and Anvil fork problems in ArbiSim Guard.' };
function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-3">
      <div className="px-4 py-2 border-b border-border bg-elevated"><span className="text-xs font-mono text-text-tertiary">{lang}</span></div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}
export default function RpcTroubleshootingPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Troubleshooting</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">RPC & fork issues</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">Most simulation failures trace back to the RPC endpoint used to fork the chain. Here is how to diagnose and fix each type.</p>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Public RPC rate limits</h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-3">Public RPC endpoints (like <code className="font-mono text-xs text-coral">https://api.avax.network/ext/bc/C/rpc</code>) have aggressive rate limits. When Anvil forks the chain, it makes many rapid state reads. Under load, these can hit limits and cause fork failures.</p>
          <div className="rounded-lg border border-amber/20 bg-amber/5 px-4 py-3 mb-3">
            <p className="text-amber text-sm font-medium">Signs</p>
            <p className="text-text-secondary text-sm">Status returns TIMED_OUT. Logs show "Fork initialization failed" or "eth_getBlockByNumber rate limit".</p>
          </div>
          <p className="text-text-secondary text-sm font-medium mb-2">Recommended free RPC endpoints:</p>
          <div className="space-y-2">
            {[
              { chain: 'Avalanche Mainnet', urls: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.public-rpc.com'] },
              { chain: 'Avalanche Fuji', urls: ['https://api.avax-test.network/ext/bc/C/rpc'] },
              { chain: 'Arbitrum One', urls: ['https://arb1.arbitrum.io/rpc'] },
              { chain: 'Arbitrum Sepolia', urls: ['https://sepolia-rollup.arbitrum.io/rpc'] },
            ].map(item => (
              <div key={item.chain} className="rounded-lg border border-border bg-surface p-3">
                <p className="text-text-tertiary text-xs font-mono mb-1">{item.chain}</p>
                {item.urls.map(u => <code key={u} className="block text-xs font-mono text-teal">{u}</code>)}
              </div>
            ))}
          </div>
          <p className="text-text-tertiary text-xs mt-3">For production or high-volume use, Ava Labs can provide archive RPC access. <a href="mailto:hello@arbisimguard.com" className="text-coral hover:underline">Contact us ↗</a></p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Anvil not found</h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-3">If you are running the simulation worker locally, Anvil must be installed and on your PATH.</p>
          <CodeBlock lang="bash" code={`# Check if Anvil is installed
anvil --version

# Install via Foundry (installs forge, cast, anvil, chisel)
curl -L https://foundry.paradigm.xyz | bash
foundryup`} />
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Stale fork state</h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-3">ArbiSim uses a persistent Anvil process per chain. If the process crashes and restarts, the first few requests may fail while the fork initializes.</p>
          <div className="rounded-lg border border-border bg-surface p-3 text-sm text-text-secondary">
            <p>→ Retry the simulation after 2–3 seconds. The worker will reinitialize the fork automatically.</p>
            <p className="mt-1">→ Check the worker logs for "Restarting Anvil fork for network: &lt;chain&gt;".</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Block-pinned simulations (backtesting)</h2>
          <p className="text-text-secondary text-sm leading-relaxed mb-3">When you specify a <code className="font-mono text-xs text-coral">block_number</code>, ArbiSim cannot reuse the persistent fork — it must spin up a fresh one. This takes 4–8 seconds and requires an archive node (not all public RPCs support this).</p>
          <CodeBlock lang="json" code={`{
  "network": "avalanche-mainnet",
  "block_number": 48000000,
  "agent_address": "0x...",
  "transactions": [...]
}`} />
          <p className="text-text-tertiary text-xs mt-2">Archive RPC support varies. Alchemy and Infura provide archive access on paid plans.</p>
        </section>
      </div>

      <div className="mt-10 p-4 rounded-lg border border-border bg-surface text-sm text-text-secondary">
        Still stuck? Email <a href="mailto:hello@arbisimguard.com" className="text-coral hover:underline">hello@arbisimguard.com</a> with your network, error message, and simulation job ID.
      </div>
      <div className="flex gap-4 mt-6">
        <Link href="/docs/troubleshooting" className="text-sm text-coral hover:underline">← Common errors</Link>
        <Link href="/docs/troubleshooting/mcp-setup" className="text-sm text-coral hover:underline ml-auto">MCP setup issues →</Link>
      </div>
    </article>
  );
}
