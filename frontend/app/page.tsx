'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface MarketStats {
  arbitrumSwaps90d: number | null
  avalancheSwaps90d: number | null
  arbitrumVolume90d: number | null
  avalancheVolume90d: number | null
}

function formatCount(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return n.toString()
}

function formatVolume(n: number | null): string {
  if (n === null) return '—'
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(0)}M`
  return `$${n.toFixed(0)}`
}

interface SimFlag {
  key: string;
  label: string;
  description: string;
  status: 'safe' | 'warning' | 'danger';
}

function LiveTerminal() {
  const lines = [
    { delay: 0,    text: '$ curl -X POST https://arbisim-proxy.rahulpandey-creates.workers.dev/api/v1/simulate \\', dim: false },
    { delay: 100,  text: '     -H "X-API-Key: ask_free_••••••••" \\',                           dim: true  },
    { delay: 200,  text: '     -d \'{"network":"avalanche-fuji","agent_address":"0x...","transactions":[...]}\'', dim: true },
    { delay: 800,  text: '',                                                                      dim: false },
    { delay: 900,  text: '# Safety report back in 340ms — no real money moved',                  dim: true  },
    { delay: 1000, text: '{',                                                                     dim: false },
    { delay: 1100, text: '  "verdict": "REJECTED",',                                             dim: false },
    { delay: 1200, text: '  "reason": "Transaction would lose more than expected",',             dim: false },
    { delay: 1300, text: '  "checks": {',                                                         dim: false },
    { delay: 1400, text: '    "price_impact_too_high": true,   // 12.4% — your limit is 2%',    dim: false },
    { delay: 1500, text: '    "frontrun_risk": true,           // another tx sandwiches yours', dim: false },
    { delay: 1600, text: '    "would_revert": false,',                                            dim: false },
    { delay: 1700, text: '    "use_priority_lane": true        // saves 200ms on Arbitrum',      dim: false },
    { delay: 1800, text: '  },',                                                                  dim: false },
    { delay: 1900, text: '  "gas_cost": "0.00021 AVAX",',                                        dim: false },
    { delay: 2000, text: '  "action": "ABORT — protect your funds"',                             dim: false },
    { delay: 2100, text: '}',                                                                     dim: false },
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
        <span className="ml-3 text-text-tertiary text-xs">arbisim - simulation output</span>
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
    { key: 'execution_reverted',    label: 'Transaction would fail',     description: 'The transaction would revert on-chain. Your funds would be safe, but gas would still be wasted. ArbiSim catches this before it costs you.',  status: 'danger'  },
    { key: 'high_slippage',         label: 'Price impact too high',       description: 'The trade would move the price more than your set limit. You would receive significantly fewer tokens than expected.',                            status: 'warning' },
    { key: 'sandwich_detected',     label: 'Someone is front-running you', description: 'Two transactions surrounding yours in the same block were detected — a classic MEV sandwich attack. Your trade would be exploited.',             status: 'danger'  },
    { key: 'unsafe_allowance',      label: 'Risky token permission',      description: 'Your approval gives a contract more access than this transaction needs. Excess allowances can be drained in a future attack.',                    status: 'warning' },
    { key: 'sig_failed',            label: 'Signature check failed',      description: 'The cryptographic signature for this transaction is invalid. If sent, it would be rejected immediately.',                                           status: 'danger'  },
    { key: 'valid_until_expired',   label: 'Permission has expired',      description: 'The time-based authorization for this action has passed. The transaction would be refused at the protocol level.',                                  status: 'danger'  },
    { key: 'timeboost_recommended', label: 'Use the priority lane',       description: 'Paying a small priority fee on Arbitrum would give your transaction a 200ms speed advantage and reduce the chance of being beaten by a bot.',       status: 'warning' },
    { key: 'stylus_ink_overflow',   label: 'Smart contract hit its limit', description: 'The smart contract being called runs custom code that would exceed its compute budget. The transaction would run out of gas mid-execution.',         status: 'danger'  },
    { key: 'low_agent_reputation',  label: 'Untrusted counterparty',      description: 'The address you are interacting with has a low or unknown reputation score. Proceeding carries a higher-than-normal risk of loss.',                status: 'danger'  },
    { key: 'x402_payment_risk',     label: 'Payment destination unknown', description: 'You are about to send a payment to an address that has not been verified. This flag blocks agent-to-agent payments to unverified recipients.',       status: 'danger'  },
  ];

  const glyphs: Record<string, React.ReactNode> = {
    execution_reverted:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
    high_slippage:         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    sandwich_detected:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="8" y="14" width="8" height="7" rx="1"/><line x1="6.5" y1="10" x2="12" y2="14"/><line x1="17.5" y1="10" x2="12" y2="14"/></svg>,
    unsafe_allowance:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
    sig_failed:            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><line x1="12" y1="15" x2="12" y2="18"/></svg>,
    valid_until_expired:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    timeboost_recommended: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    stylus_ink_overflow:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
    low_agent_reputation:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>,
    x402_payment_risk:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
  };

  const colors = {
    danger:  { bg: 'bg-red-950/40',    border: 'border-red-800/30',    icon: 'text-red-400',  text: 'text-red-300'    },
    warning: { bg: 'bg-amber-950/40',  border: 'border-amber-800/30',  icon: 'text-amber-400', text: 'text-amber-300'  },
    safe:    { bg: 'bg-teal-950/40',   border: 'border-teal-800/30',   icon: 'text-teal-400', text: 'text-teal-300'   },
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
      {flags.map(flag => {
        const c = colors[flag.status];
        return (
          <div key={flag.key} className={`rounded-lg border p-4 ${c.bg} ${c.border} transition-all duration-200 hover:scale-[1.02] hover:brightness-110 group`}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className={`${c.icon} opacity-80 group-hover:opacity-100 transition-opacity`}>
                {glyphs[flag.key]}
              </div>
              <span className={`text-xs font-mono font-medium ${c.text}`}>{flag.label}</span>
            </div>
            <p className="text-xs text-text-tertiary leading-relaxed">{flag.description}</p>
          </div>
        );
      })}
    </div>
  );
}

function PricingCard({ tier, price, limit, features, cta, href, highlighted }: {
  tier: string; price: string; limit: string; features: string[]; cta: string; href: string; highlighted?: boolean;
}) {
  const isEmail = href.startsWith('mailto:');
  const buttonElement = (
    <button className={`w-full py-2.5 rounded-md text-sm font-medium transition-all duration-200 active:scale-95 ${
      highlighted
        ? 'bg-coral text-white hover:bg-coral/90 shadow-lg shadow-coral/30'
        : 'border border-border text-text-primary hover:bg-elevated hover:border-zinc-600'
    }`}>
      {cta}
    </button>
  );

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
      {isEmail ? (
        <a href={href} className="w-full">
          {buttonElement}
        </a>
      ) : (
        <Link href={href} className="w-full">
          {buttonElement}
        </Link>
      )}
    </div>
  );
}

export default function HomePage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [marketStats, setMarketStats] = useState<MarketStats | null>(null);

  useEffect(() => {
    fetch('/api/market-stats')
      .then(r => r.json())
      .then(setMarketStats)
      .catch(() => {/* silently degrade */});
  }, []);

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
            <a href="#flags" className="hover:text-text-primary transition-colors">What it catches</a>
            <a href="#pricing" className="hover:text-text-primary transition-colors">Pricing</a>
            <Link href="/docs" className="hover:text-text-primary transition-colors">Docs</Link>
            <a href="https://github.com/CoderRahul01/ArbiSim" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">GitHub</a>
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
            {/* Ava Labs support badge */}
            <div className="flex flex-wrap gap-2 mb-6">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/5 text-xs text-red-400 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse-dot" />
                Supported by Ava Labs · Retro9000
              </div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-amber/30 bg-amber/5 text-xs text-amber font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-amber animate-pulse-dot" />
                Testnet live · Mainnet coming soon
              </div>
            </div>
            <h1 className="font-serif text-display text-text-primary leading-[1.05] mb-3 tracking-[-0.02em]">
              Your AI agents move money.<br />
              <span className="text-coral italic">Make sure they don&apos;t move it wrong.</span>
            </h1>
            <p className="text-lg text-text-secondary leading-relaxed mb-4 max-w-md">
              Before any transaction goes through, ArbiSim Guard runs it first — on a copy of the live blockchain.
              No real money moves. You get back a full safety report in under a second: pass or fail, and exactly why.
            </p>
            <p className="text-sm text-text-tertiary mb-6">
              Works with any AI agent framework. No blockchain expertise required to get started.
            </p>
            <div className="flex flex-wrap gap-1.5 mb-8">
              {[
                { label: '🟢 Avalanche Fuji', live: true },
                { label: '🟢 Arbitrum Sepolia', live: true },
                { label: 'Avalanche C-Chain', live: false },
                { label: 'Arbitrum One', live: false },
              ].map(chain => (
                <span key={chain.label} className={`text-xs font-mono px-2.5 py-1 rounded-full border bg-surface ${
                  chain.live
                    ? 'border-teal/40 text-teal'
                    : 'border-border text-text-tertiary'
                }`}>
                  {chain.label}{!chain.live && <span className="ml-1 text-text-tertiary/50">(soon)</span>}
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/dashboard/simulate" className="px-6 py-3 bg-coral text-white rounded-lg font-medium text-sm hover:bg-coral/90 transition-all duration-200 active:scale-95 shadow-xl shadow-coral/25 text-center">
                Try it free →
              </Link>
              <Link href="/docs"
                className="px-6 py-3 border border-border text-text-primary rounded-lg font-medium text-sm hover:bg-elevated hover:border-zinc-600 transition-all duration-200 active:scale-95 text-center">
                Read the docs
              </Link>
            </div>
            <div className="flex gap-8 mt-12 pt-8 border-t border-border">
              {[
                { value: '< 400ms', label: 'response time'    },
                { value: '10',      label: 'things it checks' },
                { value: '2',       label: 'testnets live now'},
                { value: 'free',    label: 'to get started'   },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xl font-mono font-semibold text-text-primary">{s.value}</p>
                  <p className="text-xs text-text-tertiary mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Live Dune market stats — 1h cached */}
            <div className="mt-6 rounded-lg border border-border bg-surface/60 px-4 py-3 flex flex-wrap gap-x-6 gap-y-2 items-center">
              <span className="flex items-center gap-1.5 text-xs font-mono text-text-tertiary">
                <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse-dot" />
                live market data
              </span>
              <div className="flex flex-wrap gap-x-6 gap-y-1">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-mono font-semibold text-text-primary">
                    {formatCount(marketStats?.arbitrumSwaps90d ?? null)}
                  </span>
                  <span className="text-xs text-text-tertiary">Arbitrum swaps / 90d</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-mono font-semibold text-text-primary">
                    {formatVolume(marketStats?.arbitrumVolume90d ?? null)}
                  </span>
                  <span className="text-xs text-text-tertiary">Arbitrum volume</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-mono font-semibold text-text-primary">
                    {formatCount(marketStats?.avalancheSwaps90d ?? null)}
                  </span>
                  <span className="text-xs text-text-tertiary">Avalanche swaps / 90d</span>
                </div>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-mono font-semibold text-text-primary">
                    {formatVolume(marketStats?.avalancheVolume90d ?? null)}
                  </span>
                  <span className="text-xs text-text-tertiary">Avalanche volume</span>
                </div>
              </div>
              <a
                href="https://dune.com/arbisim/arbisim-guard-safety-intelligence-dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs font-mono text-text-tertiary hover:text-coral transition-colors"
              >
                Dune ↗
              </a>
            </div>
          </div>
          <div className="animate-fade-in" style={{ animationDelay: '200ms' }}>
            <LiveTerminal />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS - Geometric Flow Diagram */}
      <section id="how-it-works" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-serif text-h1 text-text-primary mb-3">How it works</h2>
          <p className="text-text-secondary mb-12">Three steps. One API call. Zero capital at risk.</p>
          
          {/* Flow diagram */}
          <div className="relative">
            {/* Connection lines (desktop only) */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 -translate-y-1/2" style={{ zIndex: 0 }}>
              <svg width="100%" height="60" viewBox="0 0 1200 60" fill="none" preserveAspectRatio="none">
                <path d="M200 30 L500 30" stroke="url(#grad1)" strokeWidth="2" strokeDasharray="6 4" opacity="0.4"/>
                <path d="M700 30 L1000 30" stroke="url(#grad2)" strokeWidth="2" strokeDasharray="6 4" opacity="0.4"/>
                <defs>
                  <linearGradient id="grad1" x1="200" y1="30" x2="500" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#FF7849" />
                    <stop offset="1" stopColor="#F59E0B" />
                  </linearGradient>
                  <linearGradient id="grad2" x1="700" y1="30" x2="1000" y2="30" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#F59E0B" />
                    <stop offset="1" stopColor="#14B8A6" />
                  </linearGradient>
                </defs>
              </svg>
            </div>

            <div className="grid md:grid-cols-3 gap-6 relative" style={{ zIndex: 1 }}>
              {[
                { step: '01', title: 'Send your transaction plan', accent: 'coral',
                  icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 01-2 2H8a2 2 0 01-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/></svg>,
                  description: 'Your AI agent sends ArbiSim the transaction it wants to execute — a token swap, DeFi interaction, or payment. Nothing gets sent to the blockchain yet. It is just a plan.' },
                { step: '02', title: 'We run it on a live copy', accent: 'amber',
                  icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/></svg>,
                  description: 'ArbiSim forks the live blockchain at the current block — real prices, real liquidity, real everything. Your transaction executes inside this isolated copy. No gas is spent, no money moves.' },
                { step: '03', title: 'Get a clear answer', accent: 'teal',
                  icon: <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
                  description: 'In under a second you get APPROVED or REJECTED, with plain-English reasons — "price impact too high", "transaction would fail", "someone is trying to front-run you". Your agent acts on that.' },
              ].map(item => (
                <div key={item.step} className={`rounded-xl border bg-surface p-6 transition-all duration-300 hover:brightness-110 relative group ${
                  item.accent === 'coral' ? 'border-coral/20 hover:border-coral/40' :
                  item.accent === 'amber' ? 'border-amber/20 hover:border-amber/40' :
                  'border-teal/20 hover:border-teal/40'
                }`}>
                  {/* Step circle */}
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110 ${
                    item.accent === 'coral' ? 'bg-coral/10 text-coral border border-coral/20' :
                    item.accent === 'amber' ? 'bg-amber/10 text-amber border border-amber/20' :
                    'bg-teal/10 text-teal border border-teal/20'
                  }`}>
                    {item.icon}
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-xs font-mono opacity-50 ${
                      item.accent === 'coral' ? 'text-coral' :
                      item.accent === 'amber' ? 'text-amber' :
                      'text-teal'
                    }`}>{item.step}</span>
                    <h3 className="text-lg font-semibold text-text-primary">{item.title}</h3>
                  </div>
                  <p className="text-sm text-text-secondary leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* COMPETITIVE COMPARISON */}
      <section className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-serif text-h1 text-text-primary mb-3">Why ArbiSim Guard?</h2>
          <p className="text-text-secondary mb-12">Purpose-built for AI agent safety. Not a general-purpose simulator.</p>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-elevated border-b border-border">
                  <th className="px-5 py-3.5 text-left text-xs font-mono text-text-tertiary uppercase tracking-wider">Feature</th>
                  <th className="px-5 py-3.5 text-center text-xs font-mono text-coral uppercase tracking-wider">ArbiSim Guard</th>
                  <th className="px-5 py-3.5 text-center text-xs font-mono text-text-tertiary uppercase tracking-wider">Tenderly</th>
                  <th className="px-5 py-3.5 text-center text-xs font-mono text-text-tertiary uppercase tracking-wider">Blowfish</th>
                  <th className="px-5 py-3.5 text-center text-xs font-mono text-text-tertiary uppercase tracking-wider">Manual Testing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  { feature: 'AI agent-native (MCP tool)',       arbisim: true,  tenderly: false, blowfish: false, manual: false },
                  { feature: 'MEV sandwich detection',            arbisim: true,  tenderly: false, blowfish: true,  manual: false },
                  { feature: 'Pre-broadcast simulation',          arbisim: true,  tenderly: true,  blowfish: false, manual: false },
                  { feature: 'Plain-English verdict + reasons',   arbisim: true,  tenderly: false, blowfish: false, manual: false },
                  { feature: 'Sub-400ms latency',                 arbisim: true,  tenderly: false, blowfish: true,  manual: false },
                  { feature: 'Testnet support (Fuji + Sepolia)',  arbisim: true,  tenderly: true,  blowfish: true,  manual: true  },
                  { feature: 'Free tier',                         arbisim: true,  tenderly: true,  blowfish: false, manual: true  },
                ].map(row => (
                  <tr key={row.feature} className="hover:bg-elevated/50 transition-colors">
                    <td className="px-5 py-3 text-text-primary font-medium">{row.feature}</td>
                    {[row.arbisim, row.tenderly, row.blowfish, row.manual].map((val, i) => (
                      <td key={i} className="px-5 py-3 text-center">
                        {val ? (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-teal/10 text-teal">
                            <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-zinc-800/50 text-zinc-500">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><line x1="4" y1="8" x2="12" y2="8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* MCP / INTEGRATIONS */}
      <section id="mcp" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 px-2.5 py-1 rounded-full">Plug into any AI agent</span>
          </div>
          <h2 className="font-serif text-h1 text-text-primary mb-3">Connect once. Works everywhere.</h2>
          <p className="text-text-secondary mb-12 max-w-xl">
            ArbiSim plugs directly into the agent frameworks your team already uses — Claude Desktop, Cursor, Vibekit, Eliza, and LangGraph.
            One config block and your agent gains the ability to check transactions before it sends them.
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
              <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-4">x402 payment safety check</p>
              <pre className="text-xs font-mono text-text-secondary leading-relaxed overflow-x-auto">
{`// Check an x402 payment before it fires:
x402_preflight({
  network: "avalanche-fuji",
  from_address: "0x<agent>",
  to_address:   "0x<payee>",
  token_address: "0x<USDC>",
  amount_raw: "1000000"   // 1 USDC
})

// Safety report:
{
  "status": "REJECTED",
  "flags": {
    "low_agent_reputation": true,  // score 12/100
    "x402_payment_risk": true
  },
  "verdict": "ABORT - payee not trusted"
}`}
              </pre>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4 mt-6">
            {[
              { name: 'Vibekit', desc: 'Integration documented. Designed to work with the Avalanche agent ecosystem — GMX, Camelot, Aave, TraderJoe.', badge: 'Documented' },
              { name: 'Eliza', desc: 'Integration documented. Add the ArbiSim MCP server config to any Eliza agent and it can call preflight_simulate.', badge: 'Documented' },
              { name: 'LangGraph', desc: 'REST API works with any Python or TypeScript graph. Add ArbiSim as a tool node between planning and execution.', badge: 'REST API' },
            ].map(fw => (
              <div key={fw.name} className="rounded-lg border border-border bg-surface/50 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-text-primary">{fw.name}</span>
                  <span className="text-xs font-mono text-amber bg-amber/10 border border-amber/20 px-1.5 py-0.5 rounded">{fw.badge}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{fw.desc}</p>
              </div>
            ))}
          </div>
          <p className="text-xs text-text-tertiary mt-4">
            Also works standalone via REST API — no framework required. <Link href="/docs" className="text-coral hover:underline">See the quickstart →</Link>
          </p>
        </div>
      </section>

      {/* SAFETY FLAGS */}
      <section id="flags" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-serif text-h1 text-text-primary mb-3">What it checks</h2>
          <p className="text-text-secondary mb-12">ArbiSim runs 10 independent checks on every transaction. Any one of them can block execution. Each check fires independently — your agent knows exactly which one failed and why.</p>
          <FlagGrid />
          <p className="text-sm text-text-tertiary mt-6">
            <Link href="/docs/what-it-checks" className="text-coral hover:underline">Full explanation of every check →</Link>
          </p>
        </div>
      </section>

      {/* PRICING */}
      <section id="pricing" className="border-t border-border py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-serif text-h1 text-text-primary mb-3">Pricing</h2>
          <p className="text-text-secondary mb-12">Flat monthly pricing. One prevented bad transaction pays for the entire year.</p>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
            <PricingCard tier="Free" price="$0" limit="500 simulations / month"
              features={['All 10 safety checks', 'Gas breakdown', 'MEV sandwich detection', 'MCP tool support', 'Community support']}
              cta="Get free API key" href="/dashboard" />
            <PricingCard tier="Pro" price="$29" limit="10,000 simulations / month" highlighted
              features={['Everything in Free', 'Priority queue', 'Webhook callbacks', 'Usage analytics', 'Email support']}
              cta="Start building" href="/dashboard/billing" />
            <PricingCard tier="Enterprise" price="Custom" limit="Unlimited simulations"
              features={['Everything in Pro', 'Dedicated infra', 'Custom rate limits', 'SLA', 'Direct support']}
              cta="Contact us" href="mailto:hello@arbisimguard.com" />
          </div>
        </div>
      </section>

      {/* WAITLIST CTA */}
      <section className="border-t border-border py-20">
        <div className="max-w-2xl mx-auto px-6 text-center">
          <h2 className="font-serif text-h2 text-text-primary mb-4 tracking-[-0.01em]">
            Your agents are moving money.<br />Make sure they're doing it safely.
          </h2>
          <p className="text-text-secondary mb-8">
            Free to start. Works on Avalanche Fuji and Arbitrum Sepolia today. Mainnet coming soon. Setup takes under 5 minutes.
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
            <span className="text-red-400">Supported by Ava Labs</span>
            <span>·</span>
            <span>Avalanche · Arbitrum · Multi-chain</span>
          </div>
          <div className="flex items-center gap-6">
            <a href="https://github.com/CoderRahul01/ArbiSim" target="_blank" rel="noopener noreferrer" className="hover:text-text-primary transition-colors">GitHub</a>
            <Link href="/docs" className="hover:text-text-primary transition-colors">Docs</Link>
            <Link href="/dashboard" className="hover:text-text-primary transition-colors">Dashboard</Link>
            <a href="mailto:hello@arbisimguard.com" className="hover:text-text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
