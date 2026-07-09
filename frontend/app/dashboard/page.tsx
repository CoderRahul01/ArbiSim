'use client';

import Link from 'next/link';

export default function DashboardHomePage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-16 space-y-12">

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-text-primary">Dashboard</h1>
        <p className="text-text-secondary">
          Check any AI agent before trusting it with your funds.
        </p>
      </div>

      {/* Primary action — full-width card */}
      <Link
        href="/dashboard/simulate"
        id="dashboard-primary-cta"
        className="block rounded-xl border border-coral/40 bg-gradient-to-br from-coral/10 to-surface p-8 hover:from-coral/15 hover:border-coral/60 transition-all duration-300 group"
      >
        <div className="flex items-start justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🛡️</span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-coral/20 border border-coral/30 text-coral uppercase tracking-wide">
                Live
              </span>
            </div>
            <h2 className="text-xl font-semibold text-text-primary">Check an Agent</h2>
            <p className="text-text-secondary leading-relaxed max-w-md">
              Paste a wallet address or transaction payload. We run it in a safe sandbox and give
              you a <strong className="text-text-primary">SAFE</strong> or{' '}
              <strong className="text-text-primary">RISKY</strong> verdict in under a second.
              No real money moves.
            </p>
          </div>
          <span className="text-text-tertiary group-hover:text-coral group-hover:translate-x-1 transition-all text-xl mt-1">
            →
          </span>
        </div>
      </Link>

      {/* Secondary actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/logs"
          id="dashboard-history-link"
          className="rounded-lg border border-border bg-surface p-5 hover:border-zinc-600 hover:bg-elevated transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg">📋</span>
            <span className="text-text-tertiary group-hover:text-text-secondary transition-colors text-sm">→</span>
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">History</h3>
          <p className="text-xs text-text-tertiary">See all the checks you&apos;ve run.</p>
        </Link>

        <Link
          href="/dashboard/agents"
          id="dashboard-agents-link"
          className="rounded-lg border border-border bg-surface p-5 hover:border-zinc-600 hover:bg-elevated transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-lg">🤖</span>
            <span className="text-text-tertiary group-hover:text-text-secondary transition-colors text-sm">→</span>
          </div>
          <h3 className="text-sm font-semibold text-text-primary mb-1">My Agents</h3>
          <p className="text-xs text-text-tertiary">Manage and monitor your registered agents.</p>
        </Link>
      </div>

      {/* Injective registry callout */}
      <div className="rounded-lg border border-[#3B2D7A]/40 bg-[#1B1630]/30 p-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-[#A78BFA] mb-1">Injective Agent Registry</p>
          <p className="text-xs text-text-tertiary">
            Browse verified AI agents on Injective and check their safety record before delegating.
          </p>
        </div>
        <a
          href="https://agents.injective.com/registry"
          target="_blank"
          rel="noreferrer"
          id="dashboard-injective-link"
          className="flex-shrink-0 px-4 py-2 rounded-lg border border-[#3B2D7A] bg-[#1B1630] text-[#A78BFA] text-xs font-mono hover:bg-[#241D48] hover:border-[#7C3AED] transition-all"
        >
          Browse ↗
        </a>
      </div>
    </div>
  );
}
