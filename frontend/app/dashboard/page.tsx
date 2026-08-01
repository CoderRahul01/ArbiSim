'use client';

import Link from 'next/link';

export default function DashboardHomePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">

      {/* Header */}
      <div className="space-y-1 border-b border-slate-800/80 pb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold text-white tracking-tight">Agent Security Overview</h1>
          <span className="text-[10px] font-mono uppercase bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded">
            Multi-Chain
          </span>
        </div>
        <p className="text-xs text-slate-400">
          Neutral pre-flight simulation and risk checkpoint for autonomous AI agents across Avalanche, Injective, Solana, and Arbitrum.
        </p>
      </div>

      {/* Primary action — full-width dark luxury card */}
      <Link
        href="/dashboard/simulate"
        id="dashboard-primary-cta"
        className="block rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-950/40 via-slate-900/80 to-slate-950 p-8 hover:border-indigo-500/60 transition-all duration-300 group shadow-2xl relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />
        <div className="flex items-start justify-between relative z-10">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold uppercase tracking-wide flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Pre-Flight Sandbox
              </span>
            </div>
            <h2 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors">Check an Agent</h2>
            <p className="text-slate-400 text-xs leading-relaxed max-w-lg">
              Paste an agent wallet address or raw transaction payload. We simulate execution in a block-pinned ephemeral fork and return an immediate <strong className="text-emerald-400">APPROVED</strong> or <strong className="text-red-400">REJECTED</strong> verdict in under 800ms. Zero mainnet risk.
            </p>
          </div>
          <span className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all text-xl mt-1">
            →
          </span>
        </div>
      </Link>

      {/* Secondary actions */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Link
          href="/dashboard/logs"
          id="dashboard-history-link"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 hover:bg-slate-900 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>
              </svg>
            </div>
            <span className="text-slate-600 group-hover:text-slate-300 transition-colors text-sm">→</span>
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Simulation History</h3>
          <p className="text-xs text-slate-400">Browse execution receipts, trace logs, and gas reports.</p>
        </Link>

        <Link
          href="/dashboard/agents"
          id="dashboard-agents-link"
          className="rounded-xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 hover:bg-slate-900 transition-all group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-300">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
            <span className="text-slate-600 group-hover:text-slate-300 transition-colors text-sm">→</span>
          </div>
          <h3 className="text-sm font-semibold text-white mb-1">Registered Agents</h3>
          <p className="text-xs text-slate-400">Manage and monitor agent session keys and permissions.</p>
        </Link>
      </div>

      {/* Multi-chain ecosystem banner */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-white">Supported Multi-Chain Ecosystems</span>
            <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded">4 Chains Active</span>
          </div>
          <p className="text-xs text-slate-400">
            Avalanche C-Chain · Injective EVM (CLOB) · Solana SVM · Arbitrum Nitro (Stylus)
          </p>
        </div>
        <Link
          href="/docs/chains"
          id="dashboard-chains-link"
          className="flex-shrink-0 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 text-xs text-slate-200 font-mono transition-all"
        >
          View Chain Docs ↗
        </Link>
      </div>
    </div>
  );
}

