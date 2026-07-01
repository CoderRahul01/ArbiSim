import Link from 'next/link';

export const metadata = { title: 'Troubleshooting — ArbiSim Guard Docs', description: 'Common errors and fixes for ArbiSim Guard.' };

const errors = [
  {
    code: 'SIMULATION_TIMEOUT',
    title: 'Simulation timed out',
    symptom: 'Status returns TIMED_OUT after ~30 seconds.',
    cause: 'The RPC provider took too long to respond during fork initialization, or the transaction requires too many state lookups.',
    fix: [
      'Switch to a paid RPC endpoint (Alchemy, Infura, or Ava Labs archive node)',
      'Check that the network field is set correctly — common mistake is using "arbitrum" instead of "arbitrum-one"',
      'Try reducing the complexity of your transaction batch',
    ],
  },
  {
    code: 'RATE_LIMITED',
    title: 'Too many requests',
    symptom: 'HTTP 429 response from the API.',
    cause: 'The free tier allows 500 simulations per month. Either you have exceeded that, or you are sending requests faster than 1 per second.',
    fix: [
      'Add a delay between requests if you are testing in a loop',
      'Upgrade to the Pro plan for 10,000 simulations per month',
      'Check your current usage on the dashboard',
    ],
    link: '/dashboard/billing',
    linkLabel: 'View billing →',
  },
  {
    code: 'FORK_FAILED',
    title: 'Could not fork the chain',
    symptom: 'Error message: "Fork initialization failed" or "Unable to connect to RPC".',
    cause: 'The public RPC endpoint is overloaded, rate-limited, or temporarily unavailable.',
    fix: [
      'Wait 30 seconds and retry — public RPCs have burst limits',
      'For Avalanche: use https://api.avax.network/ext/bc/C/rpc or an Ava Labs-provided archive node',
      'For Arbitrum: use https://arb1.arbitrum.io/rpc or a dedicated Alchemy endpoint',
      'Check the status page at https://arbisimguard.vercel.app/status',
    ],
  },
  {
    code: 'INVALID_NETWORK',
    title: 'Network not recognized',
    symptom: 'HTTP 400: "Unsupported network: <value>".',
    cause: 'The network field in your request uses an unrecognized string.',
    fix: [],
    table: [
      { wrong: '"avalanche"', correct: '"avalanche-mainnet"' },
      { wrong: '"avax"', correct: '"avalanche-mainnet"' },
      { wrong: '"fuji"', correct: '"avalanche-fuji"' },
      { wrong: '"arbitrum"', correct: '"arbitrum-one"' },
      { wrong: '"arb"', correct: '"arbitrum-one"' },
    ],
  },
  {
    code: 'AUTH_FAILED',
    title: 'API key rejected',
    symptom: 'HTTP 401: "Invalid or revoked API key".',
    cause: 'The API key is missing, malformed, or has been revoked.',
    fix: [
      'Check that you are sending the key as the X-API-Key header (not Authorization: Bearer)',
      'Verify the full key including prefix: ask_free_a1b2_...',
      'Generate a new key from the dashboard if yours was lost',
    ],
    link: '/dashboard/api-keys',
    linkLabel: 'Manage API keys →',
  },
];

export default function TroubleshootingPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Troubleshooting</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Common errors</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">The most frequent issues and how to fix them. If your error is not listed here, check the <Link href="/docs/troubleshooting/rpc" className="text-coral hover:underline">RPC issues</Link> or <Link href="/docs/troubleshooting/mcp-setup" className="text-coral hover:underline">MCP setup</Link> guides.</p>

      <div className="space-y-6">
        {errors.map((err) => (
          <div key={err.code} className="rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-border bg-elevated/40">
              <code className="text-xs font-mono text-red-400 bg-red-950/40 border border-red-900/30 px-2.5 py-1 rounded">{err.code}</code>
              <h3 className="text-text-primary font-semibold text-sm">{err.title}</h3>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-1">Symptom</p>
                <p className="text-text-secondary text-sm italic">{err.symptom}</p>
              </div>
              <div>
                <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-1">Cause</p>
                <p className="text-text-secondary text-sm">{err.cause}</p>
              </div>
              {err.fix.length > 0 && (
                <div>
                  <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">How to fix</p>
                  <ul className="space-y-1.5">
                    {err.fix.map((f, i) => (
                      <li key={i} className="flex gap-2 text-sm text-text-secondary">
                        <span className="text-teal flex-shrink-0">→</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {err.table && (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs font-mono">
                    <thead>
                      <tr className="border-b border-border bg-elevated">
                        <th className="px-4 py-2 text-left text-text-tertiary">Wrong</th>
                        <th className="px-4 py-2 text-left text-text-tertiary">Correct</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {err.table.map((row) => (
                        <tr key={row.wrong}>
                          <td className="px-4 py-2 text-red-400">{row.wrong}</td>
                          <td className="px-4 py-2 text-teal">{row.correct}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {err.link && (
                <Link href={err.link} className="inline-flex text-xs text-coral hover:underline">{err.linkLabel}</Link>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-10 p-4 rounded-lg border border-border bg-surface text-sm text-text-secondary">
        <p>Still stuck? Email <a href="mailto:hello@arbisimguard.com" className="text-coral hover:underline">hello@arbisimguard.com</a> with your error code and the simulation request body. We respond within 24 hours.</p>
      </div>

      <div className="mt-6 flex gap-4">
        <Link href="/docs/architecture" className="text-sm text-coral hover:underline">← Architecture</Link>
        <Link href="/docs/troubleshooting/rpc" className="text-sm text-coral hover:underline ml-auto">RPC issues →</Link>
      </div>
    </article>
  );
}
