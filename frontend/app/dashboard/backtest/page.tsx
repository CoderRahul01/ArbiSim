'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

// ── Types ──────────────────────────────────────────────────────────────────

interface EquityCurveEntry {
  block: number;
  pnl_usd: number;
  cumulative_pnl_usd: number;
  status: string;
  gas_cost_eth: string;
}

interface BacktestResults {
  equity_curve: EquityCurveEntry[];
  sharpe_ratio: number;
  max_drawdown_pct: number;
  win_rate: number;
  profit_factor: number;
  total_pnl_usd: number;
  approved_count: number;
  rejected_count: number;
  sample_count: number;
  block_start: number;
  block_end: number;
  block_stride: number;
}

interface BacktestRecord {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  network: string;
  agent_address: string;
  block_start: number;
  block_end: number;
  block_stride: number;
  results: BacktestResults | null;
  created_at: string;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-teal-950/60 border-teal-600/30 text-teal-300',
    FAILED:    'bg-red-950/60 border-red-600/30 text-red-300',
    PENDING:   'bg-amber-950/60 border-amber-600/30 text-amber-300',
    RUNNING:   'bg-blue-950/60 border-blue-600/30 text-blue-300',
  };
  const icons: Record<string, string> = {
    COMPLETED: '✓', FAILED: '✗', PENDING: '⟳', RUNNING: '⟳',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-mono font-medium ${styles[status] ?? styles.PENDING}`}>
      <span className={status === 'PENDING' || status === 'RUNNING' ? 'animate-spin-slow' : ''}>{icons[status] ?? '?'}</span>
      {status}
    </span>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface px-4 py-3">
      <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-mono font-semibold text-text-primary">{value}</p>
      {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
    </div>
  );
}

const EXAMPLE_STRATEGY = JSON.stringify({
  transactions: [
    {
      to: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      data: '0x38ed1739000000000000000000000000000000000000000000000000002386f26fc10000',
      value: '0',
    },
  ],
  max_slippage: 2.0,
}, null, 2);

// ── Main page ──────────────────────────────────────────────────────────────

export default function BacktestPage() {
  const [apiKey, setApiKey] = useState('');
  const [network, setNetwork] = useState('arbitrum-one');
  const [agentAddress, setAgentAddress] = useState('0x0000000000000000000000000000000000000001');
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockStride, setBlockStride] = useState('100');
  const [strategy, setStrategy] = useState(EXAMPLE_STRATEGY);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BacktestRecord | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const { address } = useAccount();

  // Load API key from localStorage on mount (sanitized)
  useEffect(() => {
    const stored = localStorage.getItem('arbisim_api_key') || '';
    setApiKey(stored.trim().replace(/[^\x20-\x7E]/g, ''));
  }, []);

  // Auto-populate agent address from connected wallet (only replaces placeholder)
  useEffect(() => {
    if (!address) return;
    setAgentAddress(prev =>
      prev === '0x0000000000000000000000000000000000000001' ? address : prev
    );
  }, [address]);

  // Clean up polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const submit = useCallback(async () => {
    const cleanKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');
    if (!cleanKey) { alert('Enter your API key.'); return; }

    let parsedStrategy: unknown;
    try {
      parsedStrategy = JSON.parse(strategy);
    } catch {
      alert('Invalid JSON in strategy field.');
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cleanKey },
        body: JSON.stringify({
          network,
          agent_address: agentAddress,
          block_start: Number(blockStart),
          block_end: Number(blockEnd),
          block_stride: Number(blockStride),
          strategy: parsedStrategy,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        alert(err?.error?.message ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      const data = await res.json() as { backtest_id: string; status: string };
      setResult({ id: data.backtest_id, status: 'PENDING' } as BacktestRecord);

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const poll = await fetch(`${CF_WORKER_URL}/api/v1/backtest/${data.backtest_id}`, {
            headers: { 'X-API-Key': cleanKey },
          });
          if (!poll.ok) return;
          const pollData = await poll.json() as BacktestRecord;
          setResult(pollData);
          if (pollData.status === 'COMPLETED' || pollData.status === 'FAILED') {
            if (pollRef.current) clearInterval(pollRef.current);
            setLoading(false);
          }
        } catch { /* continue polling */ }
      }, 5000);

    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Network error');
      setLoading(false);
    }
  }, [apiKey, network, agentAddress, blockStart, blockEnd, blockStride, strategy]);

  const r = result?.results;

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-coral">
              <polyline points="1,12 4,5 7,9 10,3 13,7 15,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <span className="text-sm font-medium text-text-primary">Backtesting suite</span>
          </div>
          <span className="text-xs text-text-tertiary font-mono">Historical block replay</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* ── Left: Input form ────────────────────────────────────────── */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={e => {
                  const sanitized = e.target.value.replace(/[^\x20-\x7E]/g, '');
                  setApiKey(sanitized);
                  localStorage.setItem('arbisim_api_key', sanitized);
                }}
                placeholder="ask_free_••••••••••••"
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Network</label>
                <select
                  value={network}
                  onChange={e => setNetwork(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary text-sm focus:outline-none focus:border-coral/50 transition-colors"
                >
                  <option value="arbitrum-one">arbitrum-one</option>
                  <option value="arbitrum-sepolia">arbitrum-sepolia</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Agent address</label>
                <input
                  type="text"
                  value={agentAddress}
                  onChange={e => setAgentAddress(e.target.value)}
                  placeholder="0x…"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Block start</label>
                <input
                  type="number"
                  value={blockStart}
                  onChange={e => setBlockStart(e.target.value)}
                  placeholder="200000000"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Block end</label>
                <input
                  type="number"
                  value={blockEnd}
                  onChange={e => setBlockEnd(e.target.value)}
                  placeholder="200000010"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Stride</label>
                <input
                  type="number"
                  value={blockStride}
                  onChange={e => setBlockStride(e.target.value)}
                  min={1}
                  className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Strategy (JSON)</label>
              <textarea
                value={strategy}
                onChange={e => setStrategy(e.target.value)}
                rows={10}
                spellCheck={false}
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-coral/50 transition-colors leading-relaxed"
              />
            </div>

            <button
              onClick={submit}
              disabled={loading}
              className="w-full py-3.5 bg-coral text-white rounded-lg font-medium text-sm hover:bg-coral/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.99] shadow-lg shadow-coral/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Running backtest…
                </>
              ) : 'Run backtest'}
            </button>

            <p className="text-xs text-text-tertiary text-center">
              Replays your strategy across historical blocks on ephemeral Anvil forks.
            </p>
          </div>

          {/* ── Right: Results panel ─────────────────────────────────────── */}
          <div>
            {!result ? (
              <div className="rounded-xl border border-border bg-surface h-full flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
                <div className="w-12 h-12 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center text-coral text-2xl">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                    <polyline points="3,18 7,10 11,14 15,6 19,11 21,8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                  </svg>
                </div>
                <p className="text-text-primary font-medium">Backtest results appear here</p>
                <p className="text-sm text-text-tertiary max-w-xs">Configure your strategy, select a block range, and hit Run backtest.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface overflow-hidden animate-slide-up">
                {/* Header */}
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <StatusBadge status={result.status} />
                  <span className="text-xs font-mono text-text-tertiary">{result.id?.slice(0, 8)}…</span>
                </div>

                {(result.status === 'PENDING' || result.status === 'RUNNING') && (
                  <div className="px-6 py-10 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-secondary">
                      {result.status === 'PENDING' ? 'Waiting for worker…' : 'Replaying blocks…'}
                    </p>
                  </div>
                )}

                {result.status === 'FAILED' && (
                  <div className="px-6 py-6">
                    <p className="text-red-400 text-sm font-mono">{(result.results as any)?.error ?? 'Unknown error'}</p>
                  </div>
                )}

                {result.status === 'COMPLETED' && r && (
                  <>
                    {/* Stats cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-6 border-b border-border">
                      <StatCard
                        label="Total P&L"
                        value={`${r.total_pnl_usd >= 0 ? '+' : ''}${r.total_pnl_usd.toFixed(4)} USD`}
                      />
                      <StatCard
                        label="Sharpe ratio"
                        value={r.sharpe_ratio.toFixed(4)}
                        sub="Annualised (2M blocks/yr)"
                      />
                      <StatCard
                        label="Max drawdown"
                        value={`${r.max_drawdown_pct.toFixed(2)}%`}
                      />
                      <StatCard
                        label="Win rate"
                        value={`${r.win_rate.toFixed(2)}%`}
                        sub={`${r.approved_count}/${r.sample_count} approved`}
                      />
                      <StatCard
                        label="Profit factor"
                        value={r.profit_factor.toFixed(4)}
                      />
                      <StatCard
                        label="Samples"
                        value={String(r.sample_count)}
                        sub={`Blocks ${r.block_start}..${r.block_end}`}
                      />
                    </div>

                    {/* Equity curve table */}
                    <div className="px-6 py-4">
                      <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-3">Equity curve</h3>
                      <div className="max-h-72 overflow-y-auto rounded-lg border border-border">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-elevated">
                            <tr className="text-text-tertiary text-xs font-mono uppercase">
                              <th className="px-4 py-2.5 text-left">Block</th>
                              <th className="px-4 py-2.5 text-right">P&L (USD)</th>
                              <th className="px-4 py-2.5 text-right">Cumulative</th>
                              <th className="px-4 py-2.5 text-right">Gas (ETH)</th>
                              <th className="px-4 py-2.5 text-center">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border">
                            {r.equity_curve.map((entry, i) => (
                              <tr key={i} className="hover:bg-elevated/50 transition-colors">
                                <td className="px-4 py-2 font-mono text-text-secondary">{entry.block}</td>
                                <td className={`px-4 py-2 font-mono text-right ${entry.pnl_usd >= 0 ? 'text-teal' : 'text-red-400'}`}>
                                  {entry.pnl_usd >= 0 ? '+' : ''}{entry.pnl_usd.toFixed(6)}
                                </td>
                                <td className={`px-4 py-2 font-mono text-right ${entry.cumulative_pnl_usd >= 0 ? 'text-teal' : 'text-red-400'}`}>
                                  {entry.cumulative_pnl_usd >= 0 ? '+' : ''}{entry.cumulative_pnl_usd.toFixed(6)}
                                </td>
                                <td className="px-4 py-2 font-mono text-right text-text-secondary">{entry.gas_cost_eth}</td>
                                <td className="px-4 py-2 text-center">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-mono ${
                                    entry.status === 'APPROVED'
                                      ? 'bg-teal-950/60 text-teal-300 border border-teal-600/30'
                                      : 'bg-red-950/60 text-red-300 border border-red-600/30'
                                  }`}>
                                    {entry.status === 'APPROVED' ? '✓' : '✗'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
