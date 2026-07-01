import Link from 'next/link';

export const metadata = { title: 'MCP Integration — ArbiSim Guard Docs', description: 'Connect ArbiSim Guard to Claude Desktop, Cursor, and any MCP-compatible AI agent.' };

function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-4">
      <div className="px-4 py-2 border-b border-border bg-elevated">
        <span className="text-xs font-mono text-text-tertiary">{lang}</span>
      </div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

export default function McpPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Integrations</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">MCP integration</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">
        ArbiSim Guard exposes a Model Context Protocol (MCP) server. This means any MCP-compatible AI assistant — Claude Desktop, Cursor, or a custom agent — can call ArbiSim directly as a tool, with no HTTP client code needed.
      </p>

      <div className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-4 mb-8">
        <p className="text-teal text-sm font-medium mb-1">What the agent sees</p>
        <p className="text-text-secondary text-sm">Your agent gets a tool called <code className="font-mono text-coral text-xs">preflight_simulate</code>. When called, it runs the simulation and returns a structured result. The agent reads the verdict and decides whether to proceed or abort.</p>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-8 mb-3">Step 1 — Get your API key</h2>
      <p className="text-text-secondary text-sm mb-4">You need a free API key from the <Link href="/dashboard/api-keys" className="text-coral hover:underline">API Keys page</Link>.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-8 mb-3">Step 2 — Configure Claude Desktop</h2>
      <p className="text-text-secondary text-sm mb-2">Add this to your Claude Desktop config file (<code className="font-mono text-xs text-text-tertiary">~/Library/Application Support/Claude/claude_desktop_config.json</code> on macOS):</p>
      <CodeBlock lang="json" code={`{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["./gateway/dist/index.js", "--mcp"],
      "env": {
        "GATEWAY_API_KEY": "ask_free_a1b2_..."
      }
    }
  }
}`} />
      <p className="text-text-tertiary text-xs mb-6">Restart Claude Desktop after saving. You should see "arbisim-guard" listed under connected tools.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-8 mb-3">Step 3 — Configure Cursor</h2>
      <p className="text-text-secondary text-sm mb-2">Add the same block to Cursor&apos;s MCP settings at <code className="font-mono text-xs text-text-tertiary">~/.cursor/mcp.json</code>:</p>
      <CodeBlock lang="json" code={`{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["./gateway/dist/index.js", "--mcp"],
      "env": { "GATEWAY_API_KEY": "ask_free_a1b2_..." }
    }
  }
}`} />

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Available tools</h2>
      <div className="space-y-4 mb-8">
        {[
          {
            name: 'preflight_simulate',
            desc: 'Run a full safety check on any EVM transaction. Returns APPROVED or REJECTED with a structured flag object and gas breakdown.',
            params: ['network — chain to simulate on (e.g. "avalanche-fuji")', 'agent_address — the wallet sending the transaction', 'transactions — array of {to, data, value} objects', 'max_slippage_tolerance — price impact limit in percent (default: 2.0)'],
          },
          {
            name: 'x402_preflight',
            desc: 'Safety check specifically for agent-to-agent payment flows using the x402 protocol. Validates recipient reputation and payment amount.',
            params: ['network', 'from_address', 'to_address', 'token_address', 'amount_raw'],
          },
        ].map(tool => (
          <div key={tool.name} className="rounded-lg border border-border bg-surface overflow-hidden">
            <div className="px-5 py-3 border-b border-border bg-elevated/40">
              <code className="text-coral text-sm font-mono">{tool.name}</code>
            </div>
            <div className="px-5 py-4">
              <p className="text-text-secondary text-sm mb-3">{tool.desc}</p>
              <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Parameters</p>
              <ul className="space-y-1">
                {tool.params.map(p => (
                  <li key={p} className="text-xs text-text-secondary font-mono">→ {p}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Example agent interaction</h2>
      <p className="text-text-secondary text-sm mb-2">Once connected, your agent can use natural language:</p>
      <div className="rounded-lg border border-border bg-surface p-4 mb-2">
        <p className="text-text-tertiary text-sm italic">"Simulate a swap of 0.5 AVAX for USDC on Avalanche Fuji using the TraderJoe router. Abort if slippage exceeds 2%."</p>
      </div>
      <p className="text-text-tertiary text-xs mb-8">The MCP layer handles translating this into the correct API call. The agent receives back a plain verdict and can act on it.</p>

      <div className="mt-6 flex gap-4">
        <Link href="/docs/chains" className="text-sm text-coral hover:underline">← Supported chains</Link>
        <Link href="/docs/rest-api" className="text-sm text-coral hover:underline ml-auto">REST API →</Link>
      </div>
    </article>
  );
}
