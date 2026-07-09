'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-base text-text-primary">

      {/* ── NAV ────────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-base/90 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="ArbiSim Guard" width={26} height={26} className="rounded-md" />
            <span className="font-semibold text-text-primary">ArbiSim Guard</span>
            <span className="ml-1 text-[10px] font-mono text-text-tertiary border border-border rounded px-1.5 py-0.5">beta</span>
          </div>
          <div className="flex items-center gap-4">
            <a href="#how-it-works" className="hidden md:block text-sm text-text-secondary hover:text-text-primary transition-colors">
              How it works
            </a>
            <Link
              href="/dashboard/simulate"
              className="px-4 py-2 rounded-md bg-coral text-white text-sm font-medium hover:bg-coral/90 transition-all duration-200 active:scale-95"
            >
              Check an Agent →
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-6 pt-36 pb-24 text-center">
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-red-500/30 bg-red-500/5 text-xs text-red-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Supported by Ava Labs · Retro9000
          </span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#3B2D7A]/60 bg-[#1B1630]/40 text-xs text-[#A78BFA] font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-[#A78BFA] animate-pulse" />
            Live on Injective Testnet
          </span>
        </div>

        <h1 className="font-serif text-5xl md:text-6xl text-text-primary leading-[1.08] tracking-[-0.02em] mb-6">
          AI agents handle real money.<br />
          <span className="text-coral italic">Make sure yours is safe.</span>
        </h1>

        <p className="text-lg md:text-xl text-text-secondary leading-relaxed max-w-2xl mx-auto mb-10">
          Before an AI agent makes a move with your funds, ArbiSim runs it first — in a safe copy
          of the blockchain. No real money moves. You get a clear{' '}
          <strong className="text-text-primary">SAFE</strong> or{' '}
          <strong className="text-text-primary">RISKY</strong> answer in under a second.
        </p>

        <div className="flex flex-col sm:flex-row justify-center gap-3 mb-6">
          <Link
            href="/dashboard/simulate"
            id="hero-check-cta"
            className="px-8 py-3.5 bg-coral text-white rounded-lg font-semibold text-base hover:bg-coral/90 transition-all duration-200 active:scale-95 shadow-xl shadow-coral/25"
          >
            Check an Agent — it&apos;s free
          </Link>
          <a
            href="https://github.com/CoderRahul01/ArbiSim"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3.5 border border-border text-text-primary rounded-lg font-semibold text-base hover:bg-elevated hover:border-zinc-600 transition-all duration-200 active:scale-95"
          >
            View on GitHub
          </a>
        </div>

        <p className="text-xs text-text-tertiary">
          No wallet needed to try it. No technical knowledge required.
        </p>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how-it-works" className="border-t border-border py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-text-primary mb-3">How it works</h2>
            <p className="text-text-secondary">Three steps. Zero risk to your wallet.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                num: '01',
                accent: 'text-coral',
                title: "You share the agent's plan",
                body: "Paste the wallet address or the transaction your AI agent wants to make. Nothing touches the blockchain yet — it's just a plan.",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/>
                  </svg>
                ),
              },
              {
                num: '02',
                accent: 'text-amber',
                title: 'We test it in a safe copy',
                body: "ArbiSim runs the transaction on a live snapshot of the blockchain — real prices, real conditions — but completely isolated. Your money never moves.",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
              },
              {
                num: '03',
                accent: 'text-teal',
                title: 'You get a clear answer',
                body: "Green means safe to proceed. Red means something's wrong — and we tell you exactly what, in plain English. No crypto jargon.",
                icon: (
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M22 11.08V12a10 10 0 11-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                ),
              },
            ].map((step) => (
              <div
                key={step.num}
                className="rounded-xl border border-border bg-surface p-8 flex flex-col gap-5 hover:brightness-110 transition-all duration-300"
              >
                <div className="flex items-center gap-4">
                  <span className="text-xs font-mono text-text-tertiary">{step.num}</span>
                  <span className={step.accent}>{step.icon}</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHAT WE CATCH ──────────────────────────────────────── */}
      <section className="border-t border-border py-24 bg-surface/40">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-text-primary mb-3">What ArbiSim catches</h2>
            <p className="text-text-secondary">The things that could cost you money — caught before they happen.</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { icon: '🛑', label: 'Trade would fail', desc: "The transaction would revert on-chain — you'd lose gas but nothing would happen." },
              { icon: '📉', label: 'Getting a bad price', desc: "The trade would move the price against you. You'd receive far fewer tokens than expected." },
              { icon: '🎯', label: 'Someone front-running you', desc: 'A bot has spotted your trade and is positioned to profit at your expense.' },
              { icon: '🔑', label: 'Risky permission being granted', desc: "Your agent is about to give a contract far more access to your wallet than it needs." },
              { icon: '🕐', label: 'Permission already expired', desc: 'The authorization window has passed — the trade would be rejected at the protocol level.' },
              { icon: '⚠️', label: 'Sending to an unverified address', desc: 'The destination has no verified identity. This is a common pattern in scams.' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-base p-5 flex gap-4 hover:border-zinc-600 transition-colors"
              >
                <span className="text-xl mt-0.5 flex-shrink-0">{item.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-text-primary mb-1">{item.label}</p>
                  <p className="text-xs text-text-tertiary leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── WHO IS IT FOR ──────────────────────────────────────── */}
      <section className="border-t border-border py-24">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="font-serif text-4xl text-text-primary mb-3">Built for everyone</h2>
            <p className="text-text-secondary">Whether you&apos;re trusting an AI agent with your money, or building one.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-surface p-8 space-y-4">
              <div className="text-3xl">👤</div>
              <h3 className="text-xl font-semibold text-text-primary">I want to use an AI agent safely</h3>
              <p className="text-text-secondary leading-relaxed">
                Browsing AI agents on{' '}
                <a href="https://agents.injective.com/registry" target="_blank" rel="noreferrer" className="text-[#A78BFA] hover:underline">
                  agents.injective.com
                </a>?
                Before you delegate your funds, paste its address here. We check its history and run its
                next move in a sandbox. You decide with real information — not just a description.
              </p>
              <Link
                href="/dashboard/simulate"
                id="user-card-cta"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-coral text-white rounded-lg text-sm font-medium hover:bg-coral/90 transition-all active:scale-95"
              >
                Check an agent →
              </Link>
            </div>

            <div className="rounded-xl border border-border bg-surface p-8 space-y-4">
              <div className="text-3xl">🤖</div>
              <h3 className="text-xl font-semibold text-text-primary">I&apos;m building an AI agent</h3>
              <p className="text-text-secondary leading-relaxed">
                Add one API call before any transaction goes on-chain. Your agent gets back a safety
                verdict in under a second — no human in the loop. Every simulation is logged on-chain
                so your users can verify your agent&apos;s safety record independently.
              </p>
              <a
                href="https://github.com/CoderRahul01/ArbiSim"
                target="_blank"
                rel="noreferrer"
                id="dev-card-cta"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border text-text-primary rounded-lg text-sm font-medium hover:bg-elevated hover:border-zinc-600 transition-all active:scale-95"
              >
                Read the docs →
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="border-t border-border py-24">
        <div className="max-w-2xl mx-auto px-6 text-center space-y-6">
          <h2 className="font-serif text-4xl text-text-primary">
            Ready to check your first agent?
          </h2>
          <p className="text-text-secondary">
            Free. No wallet required to try it. Results in under a second.
          </p>
          <Link
            href="/dashboard/simulate"
            id="final-cta"
            className="inline-flex items-center gap-2 px-8 py-4 bg-coral text-white rounded-lg font-semibold text-base hover:bg-coral/90 transition-all duration-200 active:scale-95 shadow-xl shadow-coral/25"
          >
            Check an Agent — it&apos;s free →
          </Link>
          <div className="pt-4 flex justify-center gap-6 text-sm text-text-tertiary">
            <a href="https://github.com/CoderRahul01/ArbiSim" target="_blank" rel="noreferrer" className="hover:text-text-secondary transition-colors">
              GitHub
            </a>
            <Link href="/docs" className="hover:text-text-secondary transition-colors">
              Docs
            </Link>
            <a href="https://agents.injective.com/registry" target="_blank" rel="noreferrer" className="hover:text-[#A78BFA] transition-colors">
              Injective Registry ↗
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
