'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SUPPORTED_NETWORKS } from '../../../lib/chains';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

interface SimulationRow {
  session_id: string;
  network: string;
  agent_address: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED';
  telemetry?: any;
  created_at: string;
}

function StatusBadge({ status }: { status: SimulationRow['status'] }) {
  const styles: Record<SimulationRow['status'], string> = {
    APPROVED: 'bg-teal-950/60 border-teal-600/30 text-teal-300',
    REJECTED: 'bg-red-950/60 border-red-600/30 text-red-300',
    PENDING:  'bg-amber-950/60 border-amber-600/30 text-amber-300',
    FAILED:    'bg-zinc-900 border-zinc-700 text-zinc-400',
  };
  const icons: Record<SimulationRow['status'], string> = {
    APPROVED: '✓', REJECTED: '✗', PENDING: '⟳', FAILED: '!',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-mono font-medium ${styles[status]}`}>
      <span className={status === 'PENDING' ? 'animate-spin' : ''}>{icons[status]}</span>
      {status}
    </span>
  );
}

function formatRelativeTime(dateStr: string): { relative: string; absolute: string } {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  let relative = '';
  if (diffMins < 1) {
    relative = 'Just now';
  } else if (diffMins < 60) {
    relative = `${diffMins}m ago`;
  } else if (diffHours < 24) {
    relative = `${diffHours}h ago`;
  } else if (diffDays < 7) {
    relative = `${diffDays}d ago`;
  } else {
    relative = date.toLocaleDateString();
  }

  return {
    relative,
    absolute: date.toLocaleString(),
  };
}

export default function LogsPage() {
  const router = useRouter();
  const [apiKey, setApiKey] = useState('');
  const [logs, setLogs] = useState<SimulationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('All');
  const [networkFilter, setNetworkFilter] = useState('All');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [rerunningId, setRerunningId] = useState<string | null>(null);

  const limit = 20;

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
    setApiKey(raw.trim().replace(/[^\x20-\x7E]/g, ''));
  }, []);

  const fetchLogs = useCallback(async (currentOffset: number, clearExisting: boolean) => {
    if (!apiKey) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(currentOffset),
      });

      if (statusFilter !== 'All') params.append('status', statusFilter);
      if (networkFilter !== 'All') params.append('network', networkFilter);
      if (fromDate) params.append('from', new Date(fromDate).toISOString());
      if (toDate) params.append('to', new Date(toDate).toISOString());

      const res = await fetch(`${CF_WORKER_URL}/api/v1/logs?${params.toString()}`, {
        headers: { 'X-API-Key': apiKey },
      });

      if (res.ok) {
        const data = await res.json();
        if (clearExisting) {
          setLogs(data.simulations);
        } else {
          setLogs(prev => [...prev, ...data.simulations]);
        }
        setTotal(data.total);
        setHasMore(data.has_more);
      }
    } catch (err) {
      console.error('Failed to load logs', err);
    } finally {
      setLoading(false);
    }
  }, [apiKey, statusFilter, networkFilter, fromDate, toDate]);

  useEffect(() => {
    setOffset(0);
    fetchLogs(0, true);
  }, [fetchLogs]);

  const loadMore = () => {
    const nextOffset = offset + limit;
    setOffset(nextOffset);
    fetchLogs(nextOffset, false);
  };

  const handleRerun = async (sessionId: string) => {
    if (!apiKey) return;
    setRerunningId(sessionId);
    try {
      // 1. Fetch details including original payload
      const detailRes = await fetch(`${CF_WORKER_URL}/api/v1/simulate/${sessionId}`, {
        headers: { 'X-API-Key': apiKey },
      });
      if (!detailRes.ok) throw new Error('Failed to fetch original payload');
      const details = await detailRes.json();

      if (!details.payload) {
        alert('Original simulation payload could not be found.');
        return;
      }

      // 2. Submit new simulation
      const submitRes = await fetch(`${CF_WORKER_URL}/api/v1/simulate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify(details.payload),
      });
      if (!submitRes.ok) throw new Error('Failed to re-run simulation');
      const result = await submitRes.json();

      if (result.session_id) {
        router.push(`/dashboard/simulate/${result.session_id}`);
      }
    } catch (err) {
      console.error('Re-run failed:', err);
      alert(err instanceof Error ? err.message : 'Re-run failed');
    } finally {
      setRerunningId(null);
    }
  };

  const clearFilters = (e: React.MouseEvent) => {
    e.preventDefault();
    setStatusFilter('All');
    setNetworkFilter('All');
    setFromDate('');
    setToDate('');
    setSearchQuery('');
  };

  // Client-side search filtering by Session ID
  const filteredLogs = logs.filter(log => {
    if (!searchQuery.trim()) return true;
    return log.session_id.toLowerCase().includes(searchQuery.toLowerCase().trim());
  });

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-text-primary">Request Logs</h1>
          <span className="text-xs font-mono text-text-tertiary">{total} simulations total</span>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-6xl w-full mx-auto space-y-6">
        {/* Sticky Filter Bar */}
        <div className="p-4 rounded-xl border border-border bg-surface flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-16 z-10 shadow-md">
          <div className="flex flex-wrap items-center gap-3">
            <div>
              <label className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-elevated text-text-primary text-xs focus:outline-none focus:border-coral/50 transition-colors"
              >
                <option value="All">All Statuses</option>
                <option value="APPROVED">APPROVED</option>
                <option value="REJECTED">REJECTED</option>
                <option value="PENDING">PENDING</option>
                <option value="FAILED">FAILED</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1">Network</label>
              <select
                value={networkFilter}
                onChange={e => setNetworkFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-elevated text-text-primary text-xs focus:outline-none focus:border-coral/50 transition-colors"
              >
                <option value="All">All Networks</option>
                {Object.values(SUPPORTED_NETWORKS).map(chain => (
                  <option key={chain.id} value={chain.id}>{chain.displayName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-elevated text-text-primary text-xs font-mono focus:outline-none focus:border-coral/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-border bg-elevated text-text-primary text-xs font-mono focus:outline-none focus:border-coral/50 transition-colors"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative flex-1 md:w-64">
              <label className="block text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-1">Search Session ID</label>
              <input
                type="text"
                placeholder="Search session..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
              />
            </div>
            <div className="pt-5">
              <a
                href="#"
                onClick={clearFilters}
                className="text-xs text-text-tertiary hover:text-coral transition-colors font-medium whitespace-nowrap"
              >
                Clear filters
              </a>
            </div>
          </div>
        </div>

        {/* Api key check warning */}
        {!apiKey && (
          <div className="rounded-xl border border-amber/20 bg-amber/5 p-5 text-center">
            <p className="text-sm font-medium text-text-primary mb-2">Configure API Key First</p>
            <p className="text-xs text-text-tertiary mb-4">You need an API key to view your simulation logs.</p>
            <Link
              href="/dashboard/api-keys"
              className="px-4 py-2 bg-coral text-white text-xs font-medium rounded-lg hover:bg-coral-hover transition-colors shadow-md shadow-coral/20"
            >
              Go to API Keys
            </Link>
          </div>
        )}

        {/* Logs Table */}
        {apiKey && (
          <div className="rounded-xl border border-border bg-surface overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border bg-elevated text-[11px] font-mono text-text-tertiary uppercase tracking-wider">
                  <th className="px-6 py-3.5">Session ID</th>
                  <th className="px-6 py-3.5">Network</th>
                  <th className="px-6 py-3.5">Status</th>
                  <th className="px-6 py-3.5 text-right">Gas Cost (ETH)</th>
                  <th className="px-6 py-3.5 text-right">Net P&L (USD)</th>
                  <th className="px-6 py-3.5">Time</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {/* Empty State */}
                {!loading && filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-16 text-center">
                      <div className="w-12 h-12 rounded-xl bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
                        <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-text-tertiary">
                          <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                        </svg>
                      </div>
                      <p className="text-sm font-medium text-text-primary mb-2">No simulations found</p>
                      <p className="text-xs text-text-tertiary mb-5 max-w-xs mx-auto">Run your first simulation in the playground to start collecting logs.</p>
                      <Link
                        href="/dashboard/simulate"
                        className="px-4 py-2 bg-coral text-white text-xs font-medium rounded-lg hover:bg-coral-hover transition-colors shadow-md shadow-coral/20"
                      >
                        Run simulation
                      </Link>
                    </td>
                  </tr>
                )}

                {/* Skeletons on loading */}
                {loading && logs.length === 0 && (
                  [1, 2, 3].map(i => (
                    <tr key={i} className="animate-pulse">
                      <td className="px-6 py-4"><div className="h-4 bg-elevated rounded w-20" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-elevated rounded w-24" /></td>
                      <td className="px-6 py-4"><div className="h-6 bg-elevated rounded-full w-20" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-elevated rounded w-16 ml-auto" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-elevated rounded w-16 ml-auto" /></td>
                      <td className="px-6 py-4"><div className="h-4 bg-elevated rounded w-16" /></td>
                      <td className="px-6 py-4 text-right"><div className="h-4 bg-elevated rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                )}

                {/* Rows */}
                {filteredLogs.map(log => {
                  const timeInfo = formatRelativeTime(log.created_at);
                  const gasCost = log.telemetry?.gas_cost_eth ?? '-';
                  const netPnl = log.telemetry?.net_pnl_usd ?? '-';
                  
                  const isPositive = netPnl.startsWith('+');
                  const isNegative = netPnl.startsWith('-');
                  const pnlColor = isPositive ? 'text-teal' : isNegative ? 'text-danger' : 'text-text-secondary';

                  return (
                    <tr key={log.session_id} className="hover:bg-elevated/40 transition-colors">
                      {/* Session ID */}
                      <td className="px-6 py-4 font-mono text-xs text-text-primary">
                        <Link href={`/dashboard/simulate/${log.session_id}`} className="hover:text-coral transition-colors underline decoration-border decoration-dotted">
                          {log.session_id.slice(0, 8)}
                        </Link>
                      </td>
                      {/* Network */}
                      <td className="px-6 py-4 text-xs font-mono text-text-secondary">
                        <span className="px-2 py-0.5 rounded bg-elevated border border-border text-[10px]">
                          {log.network}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-6 py-4">
                        <StatusBadge status={log.status} />
                      </td>
                      {/* Gas */}
                      <td className="px-6 py-4 text-right font-mono text-xs text-text-primary">
                        {gasCost}
                      </td>
                      {/* P&L */}
                      <td className={`px-6 py-4 text-right font-mono text-xs font-semibold ${pnlColor}`}>
                        {netPnl}
                      </td>
                      {/* Date */}
                      <td className="px-6 py-4 text-xs text-text-tertiary" title={timeInfo.absolute}>
                        {timeInfo.relative}
                      </td>
                      {/* Actions */}
                      <td className="px-6 py-4 text-right space-x-3 text-xs">
                        <Link href={`/dashboard/simulate/${log.session_id}`} className="text-text-tertiary hover:text-text-primary transition-colors font-mono">
                          view
                        </Link>
                        <button
                          onClick={() => handleRerun(log.session_id)}
                          disabled={rerunningId !== null}
                          className="text-coral hover:text-coral-hover disabled:opacity-50 transition-colors font-mono"
                        >
                          {rerunningId === log.session_id ? 'rerunning…' : 're-run'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination Load More */}
            {hasMore && (
              <div className="px-6 py-4 bg-elevated/50 border-t border-border flex justify-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="px-4 py-2 border border-border bg-surface text-xs font-medium text-text-primary rounded-lg hover:bg-elevated hover:border-border/80 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Load more logs'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
