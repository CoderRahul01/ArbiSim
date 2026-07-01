import Link from 'next/link';

export const metadata = { title: 'Quickstart — ArbiSim Guard Docs', description: 'Get your first simulation result in under 5 minutes.' };

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-elevated">
        <span className="text-xs font-mono text-text-tertiary">{lang}</span>
      </div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

export default function QuickstartPage() {
  return (
    <article className="prose prose-invert max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Getting Started</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Quickstart</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">Get your first simulation result in under 5 minutes. No blockchain expertise needed. Works on Avalanche Fuji and Arbitrum Sepolia for free.</p>


      <div className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-4 mb-6">
        <p className="text-teal text-sm font-medium mb-2">⚡ Try it right now — no signup, no API key</p>
        <p className="text-text-secondary text-sm mb-3">Hit the public demo endpoint. Copy, paste, run. You will get a real-looking simulation response back in under a second.</p>
        <CodeBlock lang="bash" code={`# APPROVED result (Avalanche Fuji)
curl -X POST https://arbisim-proxy.rahulpandey-creates.workers.dev/api/v1/demo \\
  -H "Content-Type: application/json" \\
  -d '{"network":"avalanche-fuji","agent_address":"0xYourAgent"}'

# REJECTED result — shows MEV detection (Arbitrum)
curl -X POST https://arbisim-proxy.rahulpandey-creates.workers.dev/api/v1/demo \\
  -H "Content-Type: application/json" \\
  -d '{"network":"arbitrum-one","agent_address":"0xYourAgent"}'`} />
        <p className="text-text-tertiary text-xs">This endpoint is public, has no rate limit, and is specifically designed for demos and evaluations. It returns realistic responses based on the network you choose.</p>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Step 1 — Get a free API key (for live simulations)</h2>
      <p className="text-text-secondary text-sm mb-3">Go to the <Link href="/dashboard/api-keys" className="text-coral hover:underline">API Keys page</Link> and click &quot;Create key&quot;. You will get back a key that looks like:</p>
      <CodeBlock lang="text" code="ask_free_a1b2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
      <p className="text-text-tertiary text-xs mb-4">Store this immediately — it is only shown once.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Step 2 — Run your first simulation</h2>
      <p className="text-text-secondary text-sm mb-3">This call simulates a token swap on Avalanche Fuji testnet. Nothing real happens — it is just a test:</p>
      <CodeBlock lang="bash" code={`curl -X POST https://arbisim-proxy.rahulpandey-creates.workers.dev/api/v1/simulate \
  -H "Content-Type: application/json" \
  -H "X-API-Key: ask_free_a1b2_..." \
  -d '{
    "network": "avalanche-fuji",
    "agent_address": "0x0000000000000000000000000000000000000001",
    "transactions": [
      {
        "to":    "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506",
        "data":  "0x38ed1739...",
        "value": "0"
      }
    ],
    "max_slippage_tolerance": 2.0
  }'`} />

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Step 3 — Read the response</h2>
      <p className="text-text-secondary text-sm mb-3">You will get back a structured safety report:</p>
      <CodeBlock lang="json" code={`{
  "status": "APPROVED",
  "checks": {
    "would_revert": false,
    "price_impact_too_high": false,
    "frontrun_detected": false,
    "risky_allowance": false
  },
  "gas_cost": "0.00021 AVAX",
  "verdict": "SAFE — proceed"
}`} />
      <p className="text-text-secondary text-sm mb-8">If any check fires, the status becomes <code className="font-mono text-red-400 text-xs">REJECTED</code> and the verdict explains why in plain English.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Step 4 — Connect to your agent (optional)</h2>
      <p className="text-text-secondary text-sm mb-3">If you use Claude Desktop or Cursor, add this to your MCP config:</p>
      <CodeBlock lang="json" code={`{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["./gateway/dist/index.js", "--mcp"],
      "env": { "GATEWAY_API_KEY": "ask_free_a1b2_..." }
    }
  }
}`} />
      <p className="text-text-secondary text-sm mb-8">Your agent can now say: <em className="text-text-tertiary">"Simulate a swap of 0.1 AVAX for USDC on Avalanche and abort if slippage exceeds 2%."</em></p>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-4">What next?</h2>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          { href: '/docs/what-it-checks', label: 'What every check means', desc: 'Plain-English explanation of all 10 safety checks.' },
          { href: '/docs/chains', label: 'Supported chains guide', desc: 'Avalanche-specific setup and Arbitrum configuration.' },
          { href: '/docs/mcp', label: 'MCP integration', desc: 'Connect to Claude Desktop, Cursor, or any MCP client.' },
          { href: '/docs/troubleshooting', label: 'Common errors', desc: 'Fixes for the most common problems.' },
        ].map(item => (
          <Link key={item.href} href={item.href} className="block p-4 rounded-lg border border-border bg-surface hover:border-coral/40 transition-colors group">
            <p className="text-text-primary text-sm font-medium group-hover:text-coral transition-colors mb-1">{item.label} →</p>
            <p className="text-text-tertiary text-xs">{item.desc}</p>
          </Link>
        ))}
      </div>
    </article>
  );
}
