'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface SimFlag {
  key: string;
  label: string;
  description: string;
  status: 'safe' | 'warning' | 'danger';
}

function LiveTerminal() {
  const lines = [
    { delay: 0,    text: '$ curl -X POST https://arbisim-proxy.workers.dev/api/v1/simulate \\', dim: false },
    { delay: 100,  text: '     -H "X-API-Key: ask_free_••••••••" \\',                           dim: true  },
    { delay: 200,  text: '     -d \'{"network":"arbitrum-one","agent_address":"0x...","transactions":[...]}\'' , dim: true },
    { delay: 800,  text: '',                                                                      dim: false },
    { delay: 900,  text: '# Response — 340ms',                                                   dim: true  },
    { delay: 1000, text: '{',                                                                     dim: false },
    { delay: 1100, text: '  "status": "REJECTED",',                                              dim: false },
    { delay: 1200, text: '  "flags": {',                                                          dim: false },
    { delay: 1300, text: '    "high_slippage": true,       // 12.4% detected, threshold 2%',     dim: false },
    { delay: 1400, text: '    "sandwich_detected": true,   // 2 surrounding txs, same block',    dim: false },
    { delay: 1500, text: '    "execution_reverted": false,',                                      dim: false },
    { delay: 1600, text: '    "timeboost_recommended": true',                                     dim: false },
    { delay: 1700, text: '  },',                                                                  dim: false },
    { delay: 1800, text: '  "gas": { "l2_gas_used": 185420, "l1_buffer": 12800, "total_wei": "213000000000000" },', dim: false },
    { delay: 1900, text: '  "verdict": "ABORT — capital at risk"',                               dim: false },
    { delay: 2000, text: '}',                                                                     dim: false },
  ];

  const [visibleCount, setVisibleCount] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = document.getElementById('terminal-hero');
    if (!el) return;
    const observer = new IntersectionObserver(([e]) => { if (e.isIntersecting) setStarted(true); }, { threshold: 0.3 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    lines.forEach((line, i) => {
      setTimeout(() => setVisibleCount(c => Math.max(c, i + 1)), line.delay);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  return (
    <div id="terminal-hero" className="rounded-lg border border-border bg-surface overflow-hidden font-mono text-sm" style={{ minHeight: '280px' }}>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-3 h-3 rounded-full bg-red-500 opacity-80" />
        <div className="w-3 h-3 rounded-full bg-amber opacity-80" />
        <div className="w-3 h-3 rounded-full bg-green-500 opacity-80" />
        <span className="ml-3 text-text-tertiary text-xs">arbisim — simulation output</span>
      </div>
      <div className="p-5 space-y-1">
        {lines.slice(0, visibleCount).map((line, i) => (
          <div key={i} className={`animate-fade-in ${line.dim ? 'text-text-tertiary' : 'text-text-primary'}`}>
            {line.text === '' ? <br /> : (
              line.text.includes('REJECTED') || line.text.includes('ABORT') ? (
                <span className="text-red-400">{line.text}</span>
              ) : line.text.includes('true') || line.text.includes('false') ? (
                <span dangerouslySetInnerHTML={{
                  __html: line.text
                    .replace(/true/g, '<span class="text-coral">true</span>')
                    .replace(/false/g, '<span class="text-teal-400">false</span>')
                    .replace(/(\/\/.+)$/, '<span class="opacity-50">$1</span>')
                }} />
              ) : <span>{line.text}</span>
            )}
          </div>
        ))}
        {visibleCount < lines.length && <span className="inline-block w-2 h-4 bg-coral animate-pulse" />}
      </div>
    </div>
  );
}

function FlagGrid() {
  const flags: SimFlag[] = [
    { key: 'execution_reverted',    label: 'Execution revert',   description: 'Transaction would revert on-chain. Capital not spent.',        status: 'danger'  },
    { key: 'high_slippage',         label: 'High slippage',       description: 'Price impact exceeds threshold. Swap unfavourable.',           status: 'warning' },
    { key: 'sandwich_detected',     label: 'MEV sandwich',        description: 'Surrounding txs detected. Front/back-run likely.',             status: 'danger'  },
    { key: 'unsafe_allowance',      label: 'Unsafe allowance',    description: 'Allowance exceeds transaction amount. Revoke risk.',           status: 'warning' },
    { key: 'sig_failed',            label: 'Signature invalid',   description: 'UserOp sigFailed from EntryPoint. AA20 violation.',            status: 'danger'  },
    { key: 'valid_until_expired',   label: 'Session key expired', description: 'validUntil in past. UserOp will be rejected.',                 status: 'danger'  },
    { key: 'timeboost_recommended', label: 'Timeboost advised',   description: 'Priority lane secures 200ms advantage. Premium shown.',        status: 'warning' },
    { key: 'stylus_ink_overflow',   label: 'Stylus ink limit',    description: 'WASM execution exceeds ink budget. OOG likely.',               status: 'danger'  },
  ];

  const colors = {
    danger:  { bg: 'bg-red-950/40',    border: 'border-red-800/30',    dot: 'bg-red-500',  text: 'text-red-300'    },
    warning: { bg: 'bg-amber-950/40',  border: 'border-amber-800/30',  dot: 'bg-amber',    text: 'text-amber-300'  },
    safe:    { bg: 'bg-teal-950/40',   border: 'border-teal-800/30',   dot: 'bg-teal',     text: 'text-teal-300'   },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {flags.map(flag => {
        const c = colors[flag.status];
        return (
          <div key={flag.key} className={`rounded-lg border p-4 ${c.bg} ${c.border} transition-all duration-200 hover:scale-[1.02] hover:brightness-110`}>
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${c.dot} animate-pulse-dot`} />
              <span className={`text-xs font-mono font-medium ${c.text}`}>{flag.key}</span>
            </div>
            <p className="text-sm font-medium text-text-primary mb-1">{flag.label}</p>
            <p className="text-xs text-text-tertiary leading-relaxed">{flag.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function PricingCard({ tier, price, limit, features, cta, highlighted }: {
  tier: string; price: string; limit: string; features: string[]; cta: string; highlighted?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-6 flex flex-col gap-4 transition-all duration-300 hover:scale-[1.02] ${
      highlighted
        ? 'border-coral/50 bg-gradient-to-b from-coral/10 to-surface shadow-lg shadow-coral/10'
        : 'border-border bg-surface hover:border-zinc-600'
    }`}>
      <div>
        <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-1">{tier}</p>
        <p className="text-3xl font-semibold text-text-primary">{price}<span className="text-base text-text-tertiary font-normal">/mo</span></p>
        <p className="text-sm text-text-secondary mt-1">{limit}</p>
      </div>
      <ul className="space-y-2 flex-1">
        {features.map(f => (
          <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
            <span className="text-teal mt-0.5">✓</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <button className={`w-full py-2.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-95 ${
        highlighted
          ? 'bg-coral text-white hover:bg-coral/90 shadow-lg shadow-coral/30'
          : 'border border-border text-text-primary hover:bg-elevated hover:border-zinc-600'
      }`}>
        {cta}
      </button>
    </div>
  );
}

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleWaitlist(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    setSubmitted(true);
    setSubmitting(false);
  }

  return (
    <div className="min-h-screen bg-base">
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-base/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ArbiSim Guard" width={28} height={28} className="rounded-md" />
            <span className="font-semibold text-text-primary">ArbiSim Guard</span>
            <span className="ml-1 text-xs font-mono text-text-tertiary border border-border rounded px-1.5 py-0.5">beta</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-text-secondary">
            <a href="#how-it-works" className="hover:text-text-primary transition-colors">How it works</a>
            <a href="#mcp" className="hover:text-text-primary transition-colors">MCP</a>
            <a href="#flags" className="hover:text-text-primary transition-colors">Safety flags</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
            <a href="https://github.com/rahulpandey187/arbisim-guard" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">GitHub</a>
          </div>
          <Link href="/dashboard/simulate" className="px-4 py-2 rounded-md bg-coral text-white text-sm font-medium hover:bg-coral/90 transition-all duration-200 active:scale-95 shadow-lg shadow-coral/20">
            Open Dashboard →
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="max-w-6xl mx-auto px-6 pt-32 pb-20">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="animate-slide-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-coral/30 bg-coral/5 text-xs text-coral font-mono mb-6">
              <span className="w-1.5 h-1.5 rounded-full bg-coral animate-pulse-dot" />
              Built for Arbitrum Open House London 2026
            </div>
            <h1 className="font-serif text-display text-text-primary leading-[1.05] mb-6 tracking-[-0.02em]">
              Test before you<br />
              <span className="text-coral italic">transact.</span>
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed mb-8 max-w-md">
              ArbiSim Guard gives AI agents a pre-flight safety check.
              Simulate any DeFi transaction in an isolated Arbitrum fork —
              catch reverts, slippage, and MEV before a single wei leaves your wallet.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard/simulate" className="px-6 py-3 bg-coral text-white rounded-lg font-medium text-sm hover:bg-coral/90 transition-all duration-200 active:scale-95 shadow-xl shadow-coral/25 text-center">
                Open Dashboard
              </Link>
              <a href="https://github.com/rahulpandey187/arbisim-guard" target="_blank" rel="noopener noreferrer"
                className="px-6 py-3 border border-border text-text-primary rounded-lg font-medium text-sm hover:bg-elevated hover:border-zinc-600 transition-all duration-200 active:scale-95 text-center">
                View on GitHub
              </a>
            </div>
            <div className="flex gap-8 mt-12 pt-8 border-t border-border">
              {[
                { value: '< 400ms', label: 'median latency' },
                { value: '8',       label: 'safety flags'   },
                { value: 'ERC-4337', label: 'AA support'    },
                { value: 'Stylus',  label: 'WASM detection' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xl font-mono font-semibold text-text-primary">{s.value}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <LiveTerminal />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-serif text-h1 text-text-primary mb-3">How it works</h2>
          <p className="text-text-secondary mb-12">Three steps. One API call. Zero capital at risk.</p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Fork', accent: 'coral', description: 'ArbiSim Guard spawns an ephemeral Anvil fork of Arbitrum One at the current block. Your transaction executes against the exact live state — real liquidity, real prices, real protocols.' },
              { step: '02', title: 'Analyse', accent: 'amber', description: 'The analytical engine parses execution traces, computes Nitro L1+L2 gas (with Brotli compression), detects Stylus WASM contracts, validates ERC-4337 UserOps, and scores MEV risk.' },
              { step: '03', title: 'Decide', accent: 'teal', description: 'You receive an APPROVED or REJECTED verdict with a structured safety flag object, full gas breakdown, Timeboost recommendation, and the exact revert reason if applicable.' },
            ].map(item => (
              <div key={item.step} className="rounded-xl border border-border bg-surface p-6 transition-all duration-300 hover:border-zinc-600 hover:bg-elevated">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 text-sm font-mono font-semibold ${
                  item.accent === 'coral' ? 'bg-coral/10 text-coral border border-coral/20' :
                  item.accent === 'amber' ? 'bg-amber/10 text-amber border border-amber/20' :
                  'bg-teal/10 text-teal border border-teal/20'
                }`}>{item.step}</div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">{item.title}</h3>
                <p className="text-sm text-text-secondary leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MCP INTEGRATION */}
      <section id="mcp" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 px-2.5 py-1 rounded-full">Model Context Protocol</span>
          </div>
          <h2 className="font-serif text-h1 text-text-primary mb-3">Native MCP tool. Zero REST required.</h2>
          <p className="text-text-secondary mb-12 max-w-xl">
            Call <code className="font-mono text-coral text-sm">preflight_simulate</code> directly from any MCP-compatible agent framework.
            Your agent gets a structured APPROVED/REJECTED verdict — no HTTP wiring needed.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-4">Agent config (claude_desktop_config.json)</p>
              <pre className="text-xs font-mono text-text-secondary leading-relaxed overflow-x-auto">
{`{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": [
        "./gateway/dist/index.js",
        "--mcp"
      ],
      "env": {
        "GATEWAY_API_KEY": "ask_free_••••"
      }
    }
  }
}`}
              </pre>
            </div>
            <div className="rounded-xl border border-border bg-surface p-6">
              <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-4">Tool call + structured response</p>
              <pre className="text-xs font-mono text-text-secondary leading-relaxed overflow-x-auto">
{`// Your agent calls:
preflight_simulate({
  network: "arbitrum-one",
  agent_address: "0x...",
  transactions: [{ to, data, value }],
  max_slippage_tolerance: 2.0
})

// Gets back:
{
  "status": "REJECTED",
  "flags": {
    "high_slippage": true,   // 12.4%
    "sandwich_detected": true
  },
  "gas": { "l1_buffer": 12800 },
  "verdict": "ABORT"
}`}
              </pre>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              { name: 'Vibekit', desc: 'Arbitrum-native agent framework by Ember. Supports GMX, Camelot, Aave, Pendle.', badge: 'Native' },
              { name: 'Eliza', desc: 'Multi-agent orchestration framework. Drop in the MCP plugin and call preflight_simulate from any agent.', badge: 'Plugin' },
              { name: 'LangGraph', desc: 'Use the REST tool node or the MCP client adapter to integrate with your graph.', badge: 'Adapter' },
            ].map(fw => (
              <div key={fw.name} className="rounded-lg border border-border bg-surface/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-text-primary">{fw.name}</span>
                  <span className="text-xs font-mono text-teal bg-teal/10 border border-teal/20 px-1.5 py-0.5 rounded">{fw.badge}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{fw.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SAFETY FLAGS */}
      <section id="flags" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-serif text-h1 text-text-primary mb-3">Safety flags</h2>
          <p className="text-text-secondary mb-12">Every simulation returns a structured flag object. Each flag is an independent check that can abort execution.</p>
          <FlagGrid />
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-serif text-h1 text-text-primary mb-3">Pricing</h2>
          <p className="text-text-secondary mb-12">Flat monthly pricing. One prevented bad transaction pays for the entire year.</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl">
            <PricingCard tier="Free" price="$0" limit="500 simulations / month"
              features={['All 8 safety flags', 'Gas breakdown (L1 + L2)', 'MEV sandwich scoring', 'MCP tool support', 'Community support']}
              cta="Get free API key" />
            <PricingCard tier="Pro" price="$29" limit="10,000 simulations / month" highlighted
              features={['Everything in Free', 'ERC-4337 UserOp validation', 'Timeboost premium calc', 'Stylus WASM ink metrics', 'Email support']}
              cta="Start building" />
            <PricingCard tier="Enterprise" price="$299" limit="100,000 simulations / month"
              features={['Everything in Pro', 'SLA guarantee', 'Custom rate limits', 'Webhook callbacks', 'Dedicated support']}
              cta="Contact us" />
          </div>
        </div>
      </section>

      {/* WAITLIST CTA */}
      <section className="border-t border-border py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-serif text-h2 text-text-primary mb-4 tracking-[-0.01em]">
            Protect your agents.<br />Simulate before you commit.
          </h2>
          <p className="text-text-secondary mb-8">
            Built on Arbitrum. Native MCP tool. Works with Vibekit, Eliza, and LangGraph today.
          </p>
          {submitted ? (
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-teal/10 border border-teal/30 text-teal animate-fade-in">
              <span>✓</span><span>You are on the list. We will reach out soon.</span>
            </div>
          ) : (
            <form onSubmit={handleWaitlist} className="flex gap-3 justify-center">
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required
                className="px-4 py-3 rounded-lg border border-border bg-surface text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:border-coral/50 transition-colors w-64" />
              <button type="submit" disabled={submitting}
                className="px-6 py-3 bg-coral text-white rounded-lg text-sm font-medium hover:bg-coral/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 shadow-lg shadow-coral/25 whitespace-nowrap">
                {submitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                    Joining...
                  </span>
                ) : 'Get early access'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-text-tertiary">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ArbiSim Guard" width={20} height={20} className="rounded" />
            <span>ArbiSim Guard</span>
            <span>·</span>
            <span>Built on Arbitrum</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/rahulpandey187/arbisim-guard" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">GitHub</a>
            <Link href="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link>
            <a href="mailto:hello@arbisimguard.com" className="hover:text-text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
