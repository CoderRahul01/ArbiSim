'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

interface LiveStats {
  today: number;
  month: number;
  approval_rate: number | null;
  quota_used: number;
  quota_limit: number;
}

interface AnalyticsData {
  daily_buckets: { date: string; status: string; count: number }[];
  rejection_reasons: { reason: string; count: number }[];
  gas_stats: { date: string; avg_gas: string }[];
  backtest_summary: { total: number; avg_pnl: number };
}

function useLiveStats(): LiveStats {
  const [stats, setStats] = useState<LiveStats>({
    today: 0, month: 0, approval_rate: null, quota_used: 0, quota_limit: 500,
  });

  useEffect(() => {
    const key = typeof window !== 'undefined'
      ? (localStorage.getItem('arbisim_api_key') || '').trim().replace(/[^\x20-\x7E]/g, '')
      : '';
    if (!key) return;

    fetch(`${CF_WORKER_URL}/api/v1/stats`, {
      headers: { 'X-API-Key': key },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data as LiveStats); })
      .catch(() => {});
  }, []);

  return stats;
}

function useAnalytics(): AnalyticsData | null {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  useEffect(() => {
    const key = typeof window !== 'undefined'
      ? (localStorage.getItem('arbisim_api_key') || '').trim().replace(/[^\x20-\x7E]/g, '')
      : '';
    if (!key) return;

    fetch(`${CF_WORKER_URL}/api/v1/analytics?period=30d`, {
      headers: { 'X-API-Key': key },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAnalytics(data as AnalyticsData); })
      .catch(() => {});
  }, []);

  return analytics;
}

const CHECKLIST = [
  {
    step: '01',
    title: 'Get your API key',
    description: 'Create a free API key to authenticate simulations from your agent or CLI.',
    href: '/dashboard/api-keys',
    cta: 'Create key →',
    done: false,
  },
  {
    step: '02',
    title: 'Run your first simulation',
    description: 'Paste a transaction payload and click Run — get an APPROVED or REJECTED verdict in seconds.',
    href: '/dashboard/simulate',
    cta: 'Open playground →',
    done: false,
  },
  {
    step: '03',
    title: 'Integrate with your agent',
    description: 'Call preflight_simulate from Vibekit, Eliza, or LangGraph, or hit the REST endpoint directly.',
    href: 'https://github.com/arbisim-guard/docs',
    cta: 'View docs →',
    done: false,
    external: true,
  },
];

const NETWORK_STATUS = [
  { name: 'Arbitrum One',          rpc: 'arb-mainnet.g.alchemy.com', status: 'operational' },
  { name: 'Arbitrum Sepolia',      rpc: 'arb-sepolia.g.alchemy.com',  status: 'operational' },
  { name: 'Simulation Engine',     rpc: 'Python Anvil worker',        status: 'operational' },
  { name: 'Gateway API',           rpc: 'Node / Express',             status: 'operational' },
];

export default function DashboardOverview() {
  const stats = useLiveStats();
  const analytics = useAnalytics();

  const statCards = [
    {
      label: 'Simulations today',
      value: stats.today > 0 ? String(stats.today) : '0',
      sub: stats.today > 0 ? 'since midnight UTC' : 'no activity yet',
      color: 'text-text-primary',
    },
    {
      label: 'This month',
      value: String(stats.month),
      sub: `${stats.quota_limit - stats.quota_used} free remaining`,
      color: 'text-text-primary',
    },
    {
      label: 'Approval rate',
      value: stats.approval_rate !== null ? `${stats.approval_rate}%` : '—',
      sub: stats.approval_rate !== null ? 'of terminal simulations' : 'run first simulation',
      color: stats.approval_rate !== null ? 'text-text-primary' : 'text-text-tertiary',
    },
    {
      label: 'Quota used',
      value: stats.quota_used > 0 ? `${stats.quota_used} / ${stats.quota_limit}` : '—',
      sub: 'resets monthly',
      color: stats.quota_used > 0 ? 'text-text-primary' : 'text-text-tertiary',
    },
  ];

  // Past 30 days calculation
  const dates30 = Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().split('T')[0];
  });

  // Approval Rate chart calculations
  const approvalChartData = dates30.map(dateStr => {
    const matchingCounts = analytics?.daily_buckets.filter(b => {
      const bDate = new Date(b.date).toISOString().split('T')[0];
      return bDate === dateStr;
    }) ?? [];

    const approved = matchingCounts.find(b => b.status === 'APPROVED')?.count ?? 0;
    const rejected = matchingCounts.find(b => b.status === 'REJECTED')?.count ?? 0;
    const totalSims = approved + rejected;
    const rate = totalSims > 0 ? Math.round((approved / totalSims) * 100) : 0;

    return {
      date: dateStr,
      approved,
      rejected,
      total: totalSims,
      rate,
    };
  });

  // Gas Trend sparkline calculations
  const gasChartData = dates30.map(dateStr => {
    const match = analytics?.gas_stats.find(g => {
      const gDate = new Date(g.date).toISOString().split('T')[0];
      return gDate === dateStr;
    });
    return {
      date: dateStr,
      avg_gas: match ? parseFloat(match.avg_gas) : 0,
    };
  });

  const maxGas = Math.max(...gasChartData.map(g => g.avg_gas), 0.0001);
  const maxReasonCount = Math.max(...(analytics?.rejection_reasons.map(r => r.count) ?? []), 1);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-text-primary">Overview</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal animate-pulse-dot" />
            <span className="text-xs text-text-tertiary">All systems operational</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-5xl w-full mx-auto">

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statCards.map(s => (
            <div key={s.label} className="p-5 rounded-xl border border-border bg-surface hover:bg-elevated transition-colors duration-200">
              <p className="text-xs text-text-tertiary mb-2 font-mono">{s.label}</p>
              <p className={`text-2xl font-semibold font-mono ${s.color}`}>{s.value}</p>
              <p className="text-xs text-text-tertiary mt-1">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Rejection spike alert */}
        {(() => {
          const today = new Date().toISOString().split('T')[0];
          const todayBuckets = analytics?.daily_buckets.filter(b => {
            return new Date(b.date).toISOString().split('T')[0] === today;
          }) ?? [];
          const todayApproved = todayBuckets.find(b => b.status === 'APPROVED')?.count ?? 0;
          const todayRejected = todayBuckets.find(b => b.status === 'REJECTED')?.count ?? 0;
          const todayTotal = todayApproved + todayRejected;
          const todayRate = todayTotal > 0 ? Math.round((todayApproved / todayTotal) * 100) : 100;
          if (todayTotal > 5 && todayRate < 50) {
            return (
              <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/5 px-5 py-4">
                <span className="text-amber mt-0.5 shrink-0">⚠</span>
                <p className="text-xs text-amber leading-relaxed">
                  High rejection rate today (approval: {todayRate}%). Review your transaction parameters or check network conditions.
                </p>
              </div>
            );
          }
          return null;
        })()}

        {/* Analytics Section */}
        <div className="mb-8 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-mono uppercase tracking-widest text-text-tertiary">Risk & Performance Analytics</h2>
            <span className="text-[10px] font-mono text-text-tertiary bg-elevated border border-border px-2 py-0.5 rounded">Last 30 Days</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Approval Rate Trend (CSS Stacked Bar Chart) */}
            <div className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-text-primary mb-1">Approval Rate Trend</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Daily ratio of approved vs rejected simulations</p>
              </div>

              <div className="flex items-end gap-[2px] h-[100px] justify-between border-b border-border pb-1">
                {approvalChartData.map((d, idx) => {
                  const dayNum = new Date(d.date).getDate();
                  const showLabel = idx % 5 === 0;
                  
                  return (
                    <div key={d.date} className="group relative flex-1 flex flex-col justify-end h-full cursor-pointer">
                      {/* Tooltip */}
                      <div className="group-hover:block hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-950 border border-border text-[10px] text-text-primary px-2 py-1 rounded shadow-xl whitespace-nowrap z-20 font-mono">
                        {new Date(d.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {d.approved} approved, {d.rejected} rejected ({d.rate}%)
                      </div>

                      {/* Stacked bar */}
                      {d.total === 0 ? (
                        <div className="h-[2px] bg-zinc-800 rounded w-full" />
                      ) : (
                        <div className="w-full flex flex-col justify-end h-full">
                          <div className="bg-red-500/80 w-full" style={{ height: `${100 - d.rate}%` }} />
                          <div className="bg-teal w-full" style={{ height: `${d.rate}%` }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[8px] font-mono text-text-tertiary mt-2">
                {approvalChartData.map((d, idx) => {
                  const dateObj = new Date(d.date);
                  const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return idx % 5 === 0 ? <span key={d.date}>{label}</span> : null;
                })}
              </div>
            </div>

            {/* Average Gas Cost Sparkline */}
            <div className="p-5 rounded-xl border border-border bg-surface flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-text-primary mb-1">Gas Cost Trend</h3>
                <p className="text-[10px] text-text-tertiary mb-4">Average gas cost per day in ETH</p>
              </div>

              <div className="flex items-end gap-[3px] h-[100px] justify-between border-b border-border pb-1">
                {gasChartData.map((g, idx) => {
                  const pct = maxGas > 0 ? (g.avg_gas / maxGas) * 100 : 0;
                  return (
                    <div key={g.date} className="group relative flex-1 flex flex-col justify-end h-full cursor-pointer">
                      {/* Tooltip */}
                      <div className="group-hover:block hidden absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-zinc-950 border border-border text-[10px] text-text-primary px-2 py-1 rounded shadow-xl whitespace-nowrap z-20 font-mono">
                        {new Date(g.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: {g.avg_gas.toFixed(6)} ETH
                      </div>

                      <div className="bg-coral w-full rounded-t-sm" style={{ height: `${pct}%`, minHeight: g.avg_gas > 0 ? '2px' : '0px' }} />
                    </div>
                  );
                })}
              </div>

              {/* X-Axis Labels */}
              <div className="flex justify-between text-[8px] font-mono text-text-tertiary mt-2">
                {gasChartData.map((g, idx) => {
                  const dateObj = new Date(g.date);
                  const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  return idx % 5 === 0 ? <span key={g.date}>{label}</span> : null;
                })}
              </div>
            </div>

            {/* Rejection Reasons & Backtest Summary */}
            <div className="space-y-4">
              {/* Rejection reasons */}
              <div className="p-4 rounded-xl border border-border bg-surface">
                <h3 className="text-xs font-semibold text-text-primary mb-2">Rejection Reasons</h3>
                <div className="space-y-2">
                  {!analytics || analytics.rejection_reasons.length === 0 ? (
                    <p className="text-[10px] text-text-tertiary italic">No rejections recorded.</p>
                  ) : (
                    analytics.rejection_reasons.slice(0, 3).map((r, i) => {
                      const pct = Math.max((r.count / maxReasonCount) * 100, 5);
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex justify-between text-[9px] font-mono">
                            <span className="text-text-secondary truncate max-w-[180px]">{r.reason}</span>
                            <span className="text-text-primary font-semibold">{r.count}</span>
                          </div>
                          <div className="w-full bg-elevated rounded-full h-1.5 overflow-hidden">
                            <div className="bg-coral h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Backtest summary card */}
              <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between">
                <div>
                  <h4 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">Backtest Analytics</h4>
                  <p className="text-base font-semibold text-text-primary font-mono mt-1">
                    {analytics?.backtest_summary.total ?? 0} run(s)
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-mono text-text-tertiary block">Avg P&L</span>
                  <span className={`text-sm font-mono font-semibold block mt-1 ${
                    (analytics?.backtest_summary.avg_pnl ?? 0) >= 0 ? 'text-teal' : 'text-danger'
                  }`}>
                    {(analytics?.backtest_summary.avg_pnl ?? 0) >= 0 ? '+' : ''}
                    ${(analytics?.backtest_summary.avg_pnl ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Left: Onboarding */}
          <div className="md:col-span-2 rounded-xl border border-border bg-surface overflow-hidden">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Get started</h2>
              <span className="text-xs font-mono text-text-tertiary">0 / 3 complete</span>
            </div>
            <div className="divide-y divide-border">
              {CHECKLIST.map((item, i) => (
                <div key={i} className="px-6 py-5 flex gap-4 group">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 text-xs font-mono font-semibold transition-colors ${
                    item.done
                      ? 'bg-teal/10 border-teal/30 text-teal'
                      : 'bg-elevated border-border text-text-tertiary'
                  }`}>
                    {item.done ? '✓' : item.step}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium mb-1 ${item.done ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                      {item.title}
                    </p>
                    <p className="text-xs text-text-tertiary leading-relaxed mb-3">{item.description}</p>
                    {item.external ? (
                      <a href={item.href} target="_blank" rel="noopener noreferrer"
                        className="text-xs font-medium text-coral hover:text-coral-hover transition-colors">
                        {item.cta}
                      </a>
                    ) : (
                      <Link href={item.href} className="text-xs font-medium text-coral hover:text-coral-hover transition-colors">
                        {item.cta}
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: System status */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-text-primary">System status</h2>
              </div>
              <div className="divide-y divide-border">
                {NETWORK_STATUS.map(n => (
                  <div key={n.name} className="px-5 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-text-primary">{n.name}</p>
                      <p className="text-xs text-text-tertiary font-mono">{n.rpc}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                      <span className="text-xs text-teal">up</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick actions */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-4 border-b border-border">
                <h2 className="text-sm font-semibold text-text-primary">Quick actions</h2>
              </div>
              <div className="p-3 space-y-2">
                <Link href="/dashboard/simulate"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated border border-transparent hover:border-border transition-all duration-150 group">
                  <div className="w-7 h-7 rounded-md bg-coral/10 border border-coral/20 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-coral">
                      <polygon points="3,2 13,8 3,14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Run a simulation</p>
                    <p className="text-xs text-text-tertiary">Test any transaction</p>
                  </div>
                </Link>
                <Link href="/dashboard/api-keys"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated border border-transparent hover:border-border transition-all duration-150 group">
                  <div className="w-7 h-7 rounded-md bg-amber/10 border border-amber/20 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-amber">
                      <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M8.5 8.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Create API key</p>
                    <p className="text-xs text-text-tertiary">Self-serve access</p>
                  </div>
                </Link>
                <Link href="/dashboard/billing"
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-elevated border border-transparent hover:border-border transition-all duration-150 group">
                  <div className="w-7 h-7 rounded-md bg-teal/10 border border-teal/20 flex items-center justify-center shrink-0">
                    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-teal">
                      <rect x="1" y="3.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
                      <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.5"/>
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-text-primary">Manage plan</p>
                    <p className="text-xs text-text-tertiary">Free · 500 sims/mo</p>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* MCP tool callout */}
        <div className="mt-6 rounded-xl border border-coral/20 bg-coral/5 p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 px-2 py-0.5 rounded">MCP</span>
                <h3 className="text-sm font-semibold text-text-primary">preflight_simulate — native MCP tool</h3>
              </div>
              <p className="text-xs text-text-secondary leading-relaxed max-w-xl">
                Call ArbiSim Guard directly from Vibekit, Eliza, or LangGraph using the Model Context Protocol.
                No REST integration needed — your agent calls <code className="font-mono text-coral">preflight_simulate</code> and gets a structured APPROVED/REJECTED verdict.
              </p>
            </div>
            <a href="https://github.com/arbisim-guard/docs/mcp" target="_blank" rel="noopener noreferrer"
              className="shrink-0 px-4 py-2 rounded-lg border border-coral/30 bg-coral/10 text-coral text-xs font-medium hover:bg-coral/20 transition-colors whitespace-nowrap">
              View MCP docs →
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
