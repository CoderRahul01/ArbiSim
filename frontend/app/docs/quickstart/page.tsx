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
        <p className="text-text-secondary text-sm mb-3">Hit the public endpoint or use Circle x402 Agent Nanopayments ($0.001 USDC/call). Copy, paste, run. You will get a real-looking simulation response back in under a second.</p>
        <CodeBlock lang="bash" code={`# Circle Agent Wallet Policy Pre-Check Hook (x402 Authorized)
curl -X POST https://api.arbisimguard.com/api/v1/circle/policy-check \\
  -H "Content-Type: application/json" \\
  -H "X-402-Payment: x402 0xYourAgentWallet:0.001:0xSig" \\
  -d '{
    "walletId": "circle_agent_wallet_01",
    "network": "arbitrum-one",
    "transaction": {
      "to": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "data": "0xa9059cbb...",
      "value": "0x0"
    }
  }'`} />
        <p className="text-text-tertiary text-xs">This endpoint acts as an instant policy guardrail for Circle Agent Wallets and AI agents, backed by block-accurate ephemeral fork simulations.</p>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Step 1 — Get an API key or use Circle x402 Nanopayments</h2>
      <p className="text-text-secondary text-sm mb-3">Go to the <Link href="/dashboard/api-keys" className="text-coral hover:underline">API Keys page</Link> and click &quot;Create key&quot;. Alternatively, send an <code className="font-mono text-xs text-coral">X-402-Payment</code> header with any request to pay per call in USDC gaslessly.</p>
      <CodeBlock lang="text" code="ask_free_a1b2_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
      <p className="text-text-tertiary text-xs mb-4">Store this key safely — it is only shown once.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Step 2 — Run your first simulation</h2>
      <p className="text-text-secondary text-sm mb-3">This call simulates a token transaction on Arbitrum One. Nothing real happens — it is an ephemeral fork simulation:</p>
      <CodeBlock lang="bash" code={`curl -X POST https://api.arbisimguard.com/api/v1/simulate \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ask_free_a1b2_..." \\
  -d '{
    "network": "arbitrum-one",
    "agent_address": "0x0000000000000000000000000000000000000001",
    "transactions": [
      {
        "to":    "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "data":  "0xa9059cbb...",
        "value": "0"
      }
    ],
    "max_slippage_tolerance": 0.5
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
  "gas_cost": "0.00002132 ETH",
  "verdict": "SAFE — proceed"
}`} />
      <p className="text-text-secondary text-sm mb-8">If any check fires, the status becomes <code className="font-mono text-red-400 text-xs">REJECTED</code> and the verdict explains why in plain English.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Step 4 — Connect to your agent (optional)</h2>
      <p className="text-text-secondary text-sm mb-3">If you use Claude Desktop, OpenClaw, or Cursor, install the Circle CLI skill or add this to your MCP config:</p>
      <CodeBlock lang="json" code={`{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["./gateway/dist/index.js", "--mcp"],
      "env": { "GATEWAY_API_KEY": "ask_free_a1b2_..." }
    }
  }
}`} />
      <p className="text-text-secondary text-sm mb-8">Your agent can now say: <em className="text-text-tertiary">"Simulate a USDC transfer on Arbitrum and abort if gas or slippage exceeds safety limits."</em></p>

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
