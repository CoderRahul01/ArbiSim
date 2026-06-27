'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

// ── Types ──────────────────────────────────────────────────────────────────

interface GasBreakdown {
  l2_gas_used: number;
  l1_gas_buffer: number;
  host_io_penalty_gas: number;
  total_fees_wei: string;
}

interface TimeboostData {
  vulnerability_status: string;
  mev_sandwich_risk_score: number;
  timeboost_fastlane_recommended: boolean;
  estimated_timeboost_premium_wei: string;
}

interface BalanceTrace {
  token: string;
  symbol?: string;
  pre_balance: string;
  post_balance: string;
  delta: string;
}

interface ExecutionTraceEntry {
  op: string;
  pc: number;
  gas: number;
  gasCost: number;
  depth: number;
}

interface SimulationDetail {
  session_id: string;
  sessionId: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  network: string;
  agent_address: string;
  created_at: string;
  revertReason: string | null;
  gasCostEth: string;
  netPnlUsd: string;
  slippagePercent?: number;
  stylusInkConsumed: number;
  flags: Record<string, boolean> | null;
  gasBreakdown?: GasBreakdown;
  timeboost?: TimeboostData;
  balanceTraces: BalanceTrace[];
  tokenTransfers: any[];
  executionTraces: ExecutionTraceEntry[];
}

// ── Sub-components ──────────────────────────────────────────────────────────

const DANGEROUS_FLAGS = new Set(['execution_reverted', 'sandwich_detected', 'sig_failed', 'valid_until_expired', 'stylus_ink_overflow']);

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: 'bg-teal-950/60 border-teal-600/30 text-teal-300',
    REJECTED: 'bg-red-950/60 border-red-600/30 text-red-300',
    PENDING:  'bg-amber-950/60 border-amber-600/30 text-amber-300',
  };
  const icons: Record<string, string> = {
    APPROVED: '✓', REJECTED: '✗', PENDING: '⟳',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-mono font-medium ${styles[status] ?? styles.PENDING}`}>
      <span className={status === 'PENDING' ? 'animate-spin-slow' : ''}>{icons[status] ?? '?'}</span>
      {status}
    </span>
  );
}

function FlagRow({ flagKey, value }: { flagKey: string; value: boolean }) {
  const isDangerous = DANGEROUS_FLAGS.has(flagKey) && value;
  const isWarning = !DANGEROUS_FLAGS.has(flagKey) && value;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-md border transition-colors ${
      isDangerous ? 'border-red-800/30 bg-red-950/20' :
      isWarning   ? 'border-amber-800/30 bg-amber-950/20' :
      'border-border bg-surface'
    }`}>
      <span className="font-mono text-sm text-text-secondary">{flagKey}</span>
      <span className={`text-sm font-medium ${value ? (isDangerous ? 'text-red-400' : 'text-amber-400') : 'text-teal'}`}>
        {value ? 'true' : 'false'}
      </span>
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface text-xs font-mono text-text-secondary hover:text-text-primary hover:border-coral/30 transition-colors"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          Copied!
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><rect x="5" y="5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M11 5V3.5A1.5 1.5 0 009.5 2h-7A1.5 1.5 0 001 3.5v7A1.5 1.5 0 002.5 12H5" stroke="currentColor" strokeWidth="1.5"/></svg>
          {label}
        </>
      )}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function SimulationExplorerPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [data, setData] = useState<SimulationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTraces, setShowTraces] = useState(false);
  const [apiKey, setApiKey] = useState('');

  // Try to get API key from localStorage (sanitized)
  useEffect(() => {
    const stored = localStorage.getItem('arbisim_api_key') || '';
    setApiKey(stored.trim().replace(/[^\x20-\x7E]/g, ''));
  }, []);

  useEffect(() => {
    if (!apiKey) return;
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`${CF_WORKER_URL}/api/v1/simulate/${sessionId}`, {
          headers: { 'X-API-Key': apiKey },
        });
        if (!res.ok) return;
        const json = await res.json() as SimulationDetail;
        if (!cancelled) {
          setData(json);
          if (json.status !== 'PENDING') setLoading(false);
        }
      } catch { /* retry */ }
    }

    poll();
    const interval = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [sessionId, apiKey]);

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : 'https://arbisim-guard.vercel.app';

  if (!apiKey) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="px-8 h-14 flex items-center">
            <Link href="/dashboard/simulate" className="text-xs text-text-tertiary hover:text-coral transition-colors">← Back to simulations</Link>
          </div>
        </div>
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-text-secondary mb-4">Enter your API key to view this simulation.</p>
          <input
            type="text"
            placeholder="ask_free_••••••••••••"
            onChange={e => {
              const s = e.target.value.replace(/[^\x20-\x7E]/g, '');
              setApiKey(s);
              localStorage.setItem('arbisim_api_key', s);
            }}
            className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 h-14 flex items-center justify-between">
          <Link href="/dashboard/simulate" className="text-xs text-text-tertiary hover:text-coral transition-colors">← Back to simulations</Link>
          <div className="flex items-center gap-3">
            <CopyButton text={`${siteUrl}/sim/${sessionId}`} label="Copy permalink" />
            <span className="text-xs font-mono text-text-tertiary">{sessionId.slice(0, 12)}…</span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {loading && !data && (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-text-secondary">Loading simulation…</p>
          </div>
        )}

        {data && (
          <>
            {/* ── Header row ─────────────────────────────────────────────── */}
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-wrap items-center justify-between gap-4 animate-slide-up">
              <div className="flex items-center gap-4">
                <StatusBadge status={data.status} />
                <div>
                  <p className="text-xs font-mono text-text-tertiary">Session</p>
                  <p className="text-sm font-mono text-text-primary">{data.session_id}</p>
                </div>
              </div>
              <div className="flex gap-6 text-right">
                <div>
                  <p className="text-xs text-text-tertiary">Network</p>
                  <p className="text-sm font-mono text-text-primary">{data.network}</p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary">Created</p>
                  <p className="text-sm font-mono text-text-primary">{new Date(data.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* ── Stats row ──────────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 animate-slide-up" style={{ animationDelay: '50ms' }}>
              {[
                { label: 'Verdict', value: data.status },
                { label: 'Gas cost', value: data.gasCostEth ? `${data.gasCostEth} ETH` : '-' },
                { label: 'Slippage', value: data.slippagePercent != null ? `${data.slippagePercent.toFixed(2)}%` : '-' },
                { label: 'Net P&L', value: data.netPnlUsd ?? '-' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider mb-1">{s.label}</p>
                  <p className="text-lg font-mono font-semibold text-text-primary">{s.value}</p>
                </div>
              ))}
            </div>

            {data.revertReason && (
              <div className="rounded-lg px-4 py-3 bg-red-950/30 border border-red-800/30 animate-slide-up">
                <p className="text-xs text-text-tertiary mb-1">Revert reason</p>
                <p className="text-sm font-mono text-red-300">{data.revertReason}</p>
              </div>
            )}

            {/* ── Gas breakdown stacked bar ───────────────────────────────── */}
            {data.gasBreakdown && (
              <div className="rounded-xl border border-border bg-surface p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
                <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Gas breakdown</h3>
                {(() => {
                  const gb = data.gasBreakdown!;
                  const total = (gb.l2_gas_used || 0) + (gb.l1_gas_buffer || 0) + (gb.host_io_penalty_gas || 0);
                  if (total === 0) return <p className="text-sm text-text-tertiary">No gas data</p>;
                  const pct = (v: number) => `${((v / total) * 100).toFixed(1)}%`;
                  return (
                    <>
                      <div className="flex rounded-lg overflow-hidden h-6 mb-4">
                        {gb.l2_gas_used > 0 && (
                          <div className="bg-coral/80 flex items-center justify-center text-xs font-mono text-white" style={{ width: pct(gb.l2_gas_used) }}>
                            {pct(gb.l2_gas_used)}
                          </div>
                        )}
                        {gb.l1_gas_buffer > 0 && (
                          <div className="bg-amber/70 flex items-center justify-center text-xs font-mono text-white" style={{ width: pct(gb.l1_gas_buffer) }}>
                            {pct(gb.l1_gas_buffer)}
                          </div>
                        )}
                        {gb.host_io_penalty_gas > 0 && (
                          <div className="bg-teal/60 flex items-center justify-center text-xs font-mono text-white" style={{ width: pct(gb.host_io_penalty_gas) }}>
                            {pct(gb.host_io_penalty_gas)}
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-coral/80 shrink-0" /><span className="text-xs text-text-secondary">L2 gas: <span className="font-mono text-text-primary">{gb.l2_gas_used.toLocaleString()}</span></span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-amber/70 shrink-0" /><span className="text-xs text-text-secondary">L1 buffer: <span className="font-mono text-text-primary">{gb.l1_gas_buffer.toLocaleString()}</span></span></div>
                        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded bg-teal/60 shrink-0" /><span className="text-xs text-text-secondary">Host I/O: <span className="font-mono text-text-primary">{gb.host_io_penalty_gas.toLocaleString()}</span></span></div>
                        <div className="text-xs text-text-secondary">Total fees: <span className="font-mono text-text-primary">{gb.total_fees_wei} wei</span></div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ── Balance diffs ───────────────────────────────────────────── */}
            {data.balanceTraces && data.balanceTraces.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-6 animate-slide-up" style={{ animationDelay: '150ms' }}>
                <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Balance diffs</h3>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-elevated">
                      <tr className="text-text-tertiary text-xs font-mono uppercase">
                        <th className="px-4 py-2.5 text-left">Token</th>
                        <th className="px-4 py-2.5 text-right">Pre-balance</th>
                        <th className="px-4 py-2.5 text-right">Post-balance</th>
                        <th className="px-4 py-2.5 text-right">Δ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.balanceTraces.map((bt, i) => {
                        const delta = parseFloat(bt.delta || '0');
                        return (
                          <tr key={i} className="hover:bg-elevated/50 transition-colors">
                            <td className="px-4 py-2 font-mono text-text-primary">{bt.symbol || bt.token?.slice(0, 10) || '-'}</td>
                            <td className="px-4 py-2 font-mono text-text-secondary text-right">{bt.pre_balance}</td>
                            <td className="px-4 py-2 font-mono text-text-secondary text-right">{bt.post_balance}</td>
                            <td className={`px-4 py-2 font-mono text-right font-medium ${delta >= 0 ? 'text-teal' : 'text-red-400'}`}>
                              {delta >= 0 ? '+' : ''}{bt.delta}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Flags grid ─────────────────────────────────────────────── */}
            {data.flags && (
              <div className="rounded-xl border border-border bg-surface p-6 animate-slide-up" style={{ animationDelay: '200ms' }}>
                <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Security flags</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Object.entries(data.flags).map(([k, v]) => <FlagRow key={k} flagKey={k} value={v} />)}
                </div>
              </div>
            )}

            {/* ── MEV / Timeboost card ────────────────────────────────────── */}
            {data.timeboost && (
              <div className="rounded-xl border border-border bg-surface p-6 animate-slide-up" style={{ animationDelay: '250ms' }}>
                <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">MEV / Timeboost analysis</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">Risk score</p>
                    <p className={`text-lg font-mono font-semibold ${data.timeboost.mev_sandwich_risk_score > 0.5 ? 'text-red-400' : 'text-teal'}`}>
                      {data.timeboost.mev_sandwich_risk_score.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">Vulnerability</p>
                    <p className="text-sm font-mono text-text-primary">{data.timeboost.vulnerability_status}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">Timeboost recommended</p>
                    <p className={`text-sm font-mono font-medium ${data.timeboost.timeboost_fastlane_recommended ? 'text-amber' : 'text-teal'}`}>
                      {data.timeboost.timeboost_fastlane_recommended ? 'Yes' : 'No'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-tertiary mb-1">Premium (wei)</p>
                    <p className="text-sm font-mono text-text-primary">{data.timeboost.estimated_timeboost_premium_wei}</p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Execution traces (lazy) ─────────────────────────────────── */}
            {data.executionTraces && data.executionTraces.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-6 animate-slide-up" style={{ animationDelay: '300ms' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest">Execution trace</h3>
                  <button
                    onClick={() => setShowTraces(!showTraces)}
                    className="text-xs font-mono text-coral hover:text-coral-hover transition-colors"
                  >
                    {showTraces ? 'Hide opcodes' : `Show opcodes (${data.executionTraces.length})`}
                  </button>
                </div>
                {showTraces && (
                  <div className="max-h-80 overflow-y-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-elevated">
                        <tr className="text-text-tertiary text-xs font-mono uppercase">
                          <th className="px-4 py-2.5 text-left">Op</th>
                          <th className="px-4 py-2.5 text-right">PC</th>
                          <th className="px-4 py-2.5 text-right">Gas</th>
                          <th className="px-4 py-2.5 text-right">Gas cost</th>
                          <th className="px-4 py-2.5 text-right">Depth</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {data.executionTraces.map((t, i) => (
                          <tr key={i} className="hover:bg-elevated/50 transition-colors">
                            <td className="px-4 py-1.5 font-mono text-text-primary text-xs">{t.op}</td>
                            <td className="px-4 py-1.5 font-mono text-text-secondary text-right text-xs">{t.pc}</td>
                            <td className="px-4 py-1.5 font-mono text-text-secondary text-right text-xs">{t.gas?.toLocaleString()}</td>
                            <td className="px-4 py-1.5 font-mono text-text-secondary text-right text-xs">{t.gasCost}</td>
                            <td className="px-4 py-1.5 font-mono text-text-secondary text-right text-xs">{t.depth}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
