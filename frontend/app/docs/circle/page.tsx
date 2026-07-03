import Link from 'next/link';

export const metadata = { title: 'Circle Agent Stack — ArbiSim Guard Docs', description: 'Use ArbiSim Guard as a pre-flight policy engine for Circle Agent Wallets, pay per call with Circle x402 Agent Nanopayments, and install the Circle CLI skill.' };

function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden my-4">
      <div className="px-4 py-2 border-b border-border bg-elevated"><span className="text-xs font-mono text-text-tertiary">{lang}</span></div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
    </div>
  );
}

const API_BASE = 'https://api.arbisimguard.com';

export default function CircleDocsPage() {
  return (
    <article className="max-w-none">
      <div className="mb-2 text-xs font-mono text-text-tertiary uppercase tracking-widest">Integrations</div>
      <h1 className="text-3xl font-serif font-semibold text-text-primary mb-2">Circle Agent Stack</h1>
      <p className="text-text-secondary mb-8 leading-relaxed">
        ArbiSim Guard is natively integrated with the Circle Agent Stack. AI agents using <strong className="text-text-primary">Circle Agent Wallets</strong> can route every transaction through our pre-flight policy engine before signing, and pay per call with <strong className="text-text-primary">Circle x402 Agent Nanopayments</strong> — no API key or signup required.
      </p>

      <div className="rounded-lg border border-teal/20 bg-teal/5 px-5 py-4 mb-8">
        <p className="text-teal text-sm font-medium mb-1">TL;DR for developers</p>
        <p className="text-text-secondary text-sm">Send your Circle Agent Wallet transaction or ERC-4337 UserOp to <code className="font-mono text-xs text-coral">POST /api/v1/circle/policy-check</code>. You get back <code className="font-mono text-xs text-teal">approved: true/false</code> with a plain-English reason, and a full fork simulation is logged for the audit trail. Pay $0.001 USDC per call via the <code className="font-mono text-xs text-coral">X-402-Payment</code> header, or use a normal API key.</p>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">What the integration gives you</h2>
      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        {[
          { title: 'Pre-flight policy hook', desc: 'Intercept Circle Agent Wallet payloads before they are signed. Instant APPROVED/REJECTED verdict plus a background block-accurate fork simulation.' },
          { title: 'x402 pay-per-call billing', desc: 'Agents pay $0.001 USDC per simulation via @circle-fin/x402-batching. No API keys, no credit cards, no signup friction.' },
          { title: 'USDC protection', desc: 'USDC transfers, approvals, and swaps are detected automatically and flagged in telemetry (usdcProtectionActive) for extra guardrails.' },
          { title: 'Circle CLI skill', desc: 'Install the arbisim-guard skill so agents on Circle CLI, Claude Code, Cursor, or OpenClaw can call the guardrail with one command.' },
        ].map(f => (
          <div key={f.title} className="p-4 rounded-lg border border-border bg-surface">
            <p className="text-text-primary text-sm font-semibold mb-1.5">{f.title}</p>
            <p className="text-text-tertiary text-xs leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">How it fits together</h2>
      <CodeBlock lang="flow" code={`Circle Agent Wallet                ArbiSim Guard
      |                                   |
      |  1. POST /api/v1/circle/policy-check
      |---------------------------------->|
      |                                   |-- heuristic policy checks (instant)
      |                                   |-- ephemeral Anvil fork simulation
      |                                   |   (queued, logged to audit trail)
      |  2. { approved, reason, telemetry }
      |<----------------------------------|
      |                                   |
      |  3. Sign & broadcast ONLY if approved
      v
  Arbitrum / Arc network`} />

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">POST /api/v1/circle/policy-check</h2>
      <p className="text-text-secondary text-sm mb-3">Evaluates a transaction or ERC-4337 UserOp for a Circle Agent Wallet and returns a policy verdict. Provide at least one of <code className="font-mono text-xs text-coral">transaction</code>, <code className="font-mono text-xs text-coral">userOp</code>, or <code className="font-mono text-xs text-coral">walletId</code>.</p>
      <CodeBlock lang="bash" code={`curl -X POST ${API_BASE}/api/v1/circle/policy-check \\
  -H "Content-Type: application/json" \\
  -H "X-402-Payment: x402 0xYourAgentWallet:0.001:0xSignature" \\
  -d '{
    "walletId": "circle_agent_wallet_01",
    "network": "arbitrum-one",
    "transaction": {
      "to":   "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
      "data": "0xa9059cbb...",
      "value": "0x0"
    }
  }'`} />

      <h3 className="text-base font-semibold text-text-primary mt-6 mb-3">Request body</h3>
      <div className="overflow-x-auto rounded-lg border border-border mb-6">
        <table className="w-full text-xs">
          <thead><tr className="bg-elevated border-b border-border"><th className="px-4 py-3 text-left font-mono text-text-tertiary">Field</th><th className="px-4 py-3 text-left text-text-tertiary">Type</th><th className="px-4 py-3 text-left text-text-tertiary">Required</th><th className="px-4 py-3 text-left text-text-tertiary">Description</th></tr></thead>
          <tbody className="divide-y divide-border">
            {[
              ['walletId', 'string', '—', 'Your Circle Agent Wallet identifier (for logging and telemetry).'],
              ['transaction', 'object', '*', 'Standard EVM payload: { to, data, value, gasLimit, from }.'],
              ['userOp', 'object', '*', 'ERC-4337 UserOperation: { sender, callData, ... }. Simulated against EntryPoint rules.'],
              ['network', 'string', '—', 'Target chain. Default: "arbitrum-one". Also: "arbitrum-sepolia", "arc-testnet".'],
              ['chainId', 'number', '—', 'Optional numeric chain ID, used alongside network.'],
            ].map(([f, t, r, d]) => (
              <tr key={f as string} className="hover:bg-elevated/40">
                <td className="px-4 py-2.5 font-mono text-coral">{f}</td>
                <td className="px-4 py-2.5 text-text-tertiary">{t}</td>
                <td className="px-4 py-2.5 text-center">{r}</td>
                <td className="px-4 py-2.5 text-text-secondary">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-text-tertiary text-xs mb-6">* At least one of <code className="font-mono text-coral">transaction</code> or <code className="font-mono text-coral">userOp</code> must be present, otherwise the endpoint returns <code className="font-mono">400</code> with <code className="font-mono">approved: false</code>.</p>

      <h3 className="text-base font-semibold text-text-primary mb-3">Response</h3>
      <CodeBlock lang="json" code={`{
  "approved": true,
  "policyId": "pol_circle_arbisim_guard_v1",
  "sessionId": "8f4a1c2e-...",
  "reason": "Pre-flight simulation guardrail passed. Safe to broadcast.",
  "telemetry": {
    "network": "arbitrum-one",
    "x402Verified": true,
    "usdcProtectionActive": true,
    "timestamp": "2026-07-04T10:15:00.000Z"
  }
}`} />
      <div className="overflow-x-auto rounded-lg border border-border mb-8">
        <table className="w-full text-xs">
          <thead><tr className="bg-elevated border-b border-border"><th className="px-4 py-3 text-left font-mono text-text-tertiary">Field</th><th className="px-4 py-3 text-left text-text-tertiary">Meaning</th></tr></thead>
          <tbody className="divide-y divide-border">
            {[
              ['approved', 'true = safe to sign and broadcast. false = your agent should abort.'],
              ['reason', 'Plain-English explanation of the verdict (e.g. gas limit exceeds the safety threshold).'],
              ['sessionId', 'ID of the full background fork simulation logged for the audit trail. Retrieve it later via the standard simulation API.'],
              ['telemetry.x402Verified', 'Whether this call was paid via a verified x402 nanopayment.'],
              ['telemetry.usdcProtectionActive', 'true when the payload touches USDC (transfer/approve/swap) and USDC guardrails were applied.'],
            ].map(([f, d]) => (
              <tr key={f as string}>
                <td className="px-4 py-2.5 font-mono text-coral">{f}</td>
                <td className="px-4 py-2.5 text-text-secondary">{d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Paying with Circle x402 Agent Nanopayments</h2>
      <p className="text-text-secondary text-sm mb-3">Both <code className="font-mono text-xs text-coral">/api/v1/simulate</code> and <code className="font-mono text-xs text-coral">/api/v1/circle/policy-check</code> accept x402 payments. There are three ways to authenticate a request:</p>
      <div className="space-y-3 mb-6">
        {[
          { n: '1', title: 'Official Circle SDK (recommended)', body: 'Use the @circle-fin/x402-batching client. It handles the 402 challenge, batching, and payment headers automatically.' },
          { n: '2', title: 'Manual X-402-Payment header', body: 'Attach X-402-Payment: x402 <payerAddress>:<amountUsdc>:<signatureOrTx> to any request. $0.001 USDC per simulation call.' },
          { n: '3', title: 'Classic API key', body: 'Prefer subscriptions? Create a free key in the dashboard and send it as X-API-Key. Both auth paths coexist — x402 never breaks API-key flows.' },
        ].map(step => (
          <div key={step.n} className="flex gap-4 p-4 rounded-lg border border-border bg-surface">
            <div className="w-7 h-7 rounded-full border border-coral/40 bg-coral/10 text-coral text-xs font-mono flex items-center justify-center flex-shrink-0 mt-0.5">{step.n}</div>
            <div>
              <p className="text-text-primary text-sm font-medium mb-1">{step.title}</p>
              <p className="text-text-secondary text-sm leading-relaxed">{step.body}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-text-secondary text-sm mb-3">If a request arrives with no payment and no API key, the gateway answers with an RFC-compliant <code className="font-mono text-xs text-coral">HTTP 402 Payment Required</code> that tells the agent exactly how to pay:</p>
      <CodeBlock lang="json" code={`{
  "error": "Payment Required",
  "status": 402,
  "x402": {
    "pricePerRequestUsdc": "0.001",
    "recipient": "0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1",
    "supportedChains": ["arbitrum-one", "arbitrum-sepolia", "arc-testnet"],
    "instructions": "Attach header X-402-Payment: x402 <payerAddress>:<amount>:<signatureOrTx> or use the official @circle-fin/x402-batching client."
  }
}`} />

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">TypeScript integration</h2>
      <p className="text-text-secondary text-sm mb-3">Wrap your agent&apos;s signing step with the <code className="font-mono text-xs text-coral">CircleAgentWalletGuardrail</code> connector so nothing is ever broadcast without a verdict:</p>
      <CodeBlock lang="typescript" code={`import { CircleAgentWalletGuardrail } from 'arbisim-guard';

const guardrail = new CircleAgentWalletGuardrail({
  endpoint: '${API_BASE}/api/v1',
  useX402Nanopayments: true, // pay $0.001 USDC per call, no API key
});

const policy = await guardrail.evaluatePolicy({
  walletId: 'circle_agent_wallet_01',
  network: 'arbitrum-one',
  transaction: {
    to: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
    data: '0xa9059cbb...',
  },
});

if (!policy.approved) {
  throw new Error(\`Execution aborted by ArbiSim Guard: \${policy.reason}\`);
}
// Safe — let the Circle Agent Wallet sign and broadcast.`} />

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Circle CLI skill</h2>
      <p className="text-text-secondary text-sm mb-3">Agents on Circle CLI, Claude Code, Cursor, or OpenClaw can install the guardrail as a skill:</p>
      <CodeBlock lang="bash" code={`circle skill install arbisim-guard`} />
      <p className="text-text-secondary text-sm mb-8">Once installed, the agent gains a <code className="font-mono text-xs text-coral">policy-check</code> capability it invokes automatically before any on-chain action, with x402 payment handled for you.</p>

      <h2 className="text-xl font-semibold text-text-primary mt-10 mb-3">Supported networks</h2>
      <div className="flex flex-wrap gap-1.5 mb-8">
        {['"arbitrum-one"', '"arbitrum-sepolia"', '"arc-testnet"'].map(n => (
          <code key={n} className="text-xs font-mono px-2.5 py-1 rounded border border-border bg-surface text-teal">{n}</code>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface px-5 py-4 mb-8">
        <p className="text-xs font-mono text-text-tertiary mb-2">Reference</p>
        <div className="space-y-1.5 text-sm">
          <p className="text-text-secondary">OpenAPI spec &amp; interactive docs: <a href={`${API_BASE}/api-docs`} target="_blank" rel="noopener noreferrer" className="text-coral hover:underline font-mono text-xs">{API_BASE}/api-docs ↗</a></p>
          <p className="text-text-secondary">Pricing: <span className="font-mono text-xs text-teal">$0.001 USDC</span> per policy check or simulation via x402.</p>
          <p className="text-text-secondary">Audit trail: verdicts are logged on-chain via the <span className="font-mono text-xs">SimulationRegistry</span> contract on Arbitrum Sepolia.</p>
        </div>
      </div>

      <div className="flex gap-4 mt-6">
        <Link href="/docs/rest-api" className="text-sm text-coral hover:underline">← REST API</Link>
        <Link href="/docs/frameworks" className="text-sm text-coral hover:underline ml-auto">Frameworks →</Link>
      </div>
    </article>
  );
}
