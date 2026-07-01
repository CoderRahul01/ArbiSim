import Link from 'next/link';
export const metadata = { title: 'MCP Setup Issues — ArbiSim Guard Docs', description: 'Fix MCP connection problems between Claude Desktop, Cursor, and ArbiSim Guard.' };
function CodeBlock({ code, lang = 'json' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-3">
      <div className="px-4 py-2 border-b border-border bg-elevated"><span className="text-xs font-mono text-text-tertiary">{lang}</span></div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}
export default function McpSetupPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Troubleshooting</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">MCP setup issues</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">Common problems connecting Claude Desktop, Cursor, or a custom MCP client to the ArbiSim MCP server.</p>

      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">"arbisim-guard" not appearing in tool list</h2>
          <div className="space-y-3 text-sm text-text-secondary">
            <p>→ <strong className="text-text-primary">Restart Claude Desktop or Cursor</strong> after editing the config file. Changes do not take effect until the app restarts.</p>
            <p>→ Check that your config file is valid JSON. A trailing comma or missing brace will silently break the entire MCP section.</p>
            <p>→ Verify the file path. Claude Desktop config on macOS is at:</p>
            <CodeBlock lang="text" code="~/Library/Application Support/Claude/claude_desktop_config.json" />
            <p>→ Cursor MCP config on macOS is at:</p>
            <CodeBlock lang="text" code="~/.cursor/mcp.json" />
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Tool call fails with "connection refused"</h2>
          <p className="text-text-secondary text-sm mb-3">The MCP server process is not running or crashed on startup.</p>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>→ Make sure the gateway is built: <code className="font-mono text-xs text-coral">npm run build --prefix gateway</code></p>
            <p>→ Verify the path in your config points to the correct <code className="font-mono text-xs text-coral">index.js</code>:</p>
          </div>
          <CodeBlock lang="json" code={`{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["/absolute/path/to/ArbiSim/gateway/dist/index.js", "--mcp"],
      "env": { "GATEWAY_API_KEY": "ask_free_a1b2_..." }
    }
  }
}`} />
          <p className="text-text-tertiary text-xs mt-1">Use an absolute path, not a relative one — the MCP host may run the process from a different working directory.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Tool returns "API key missing"</h2>
          <p className="text-text-secondary text-sm mb-3">The <code className="font-mono text-xs text-coral">GATEWAY_API_KEY</code> environment variable was not passed to the MCP server process.</p>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>→ Confirm the <code className="font-mono text-xs text-coral">env</code> block is inside the server config, not at the top level.</p>
            <p>→ The key must start with <code className="font-mono text-xs text-coral">ask_</code> — if you copied a partial key, regenerate it from the <Link href="/dashboard/api-keys" className="text-coral hover:underline">API Keys page</Link>.</p>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-text-primary mb-3">Simulation runs but always returns FAILED</h2>
          <p className="text-text-secondary text-sm mb-3">The MCP layer is working but the simulation worker is not reachable.</p>
          <div className="space-y-2 text-sm text-text-secondary">
            <p>→ Check that the Python worker is running: <code className="font-mono text-xs text-coral">python3 workers/src/main.py</code></p>
            <p>→ Confirm <code className="font-mono text-xs text-coral">.env</code> has valid <code className="font-mono text-xs text-coral">DATABASE_URL</code> pointing to your Neon Postgres instance.</p>
            <p>→ Try the REST API directly to isolate whether the issue is MCP-specific or deeper.</p>
          </div>
        </section>
      </div>

      <div className="mt-10 p-4 rounded-lg border border-border bg-surface text-sm text-text-secondary">
        Still stuck? Email <a href="mailto:hello@arbisimguard.com" className="text-coral hover:underline">hello@arbisimguard.com</a> with your OS, Claude Desktop or Cursor version, and the exact error message.
      </div>
      <div className="flex gap-4 mt-6">
        <Link href="/docs/troubleshooting/rpc" className="text-sm text-coral hover:underline">← RPC issues</Link>
        <Link href="/docs" className="text-sm text-coral hover:underline ml-auto">Back to docs home →</Link>
      </div>
    </article>
  );
}
