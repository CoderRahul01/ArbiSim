'use client';

import { useState, useCallback } from 'react';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

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

interface SimulationResult {
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'ERROR';
  sessionId?: string;
  revertReason?: string | null;
  gasCostEth?: string;
  slippagePercent?: number;
  flags?: Record<string, boolean>;
  gasBreakdown?: GasBreakdown;
  timeboost?: TimeboostData;
  stylusInkConsumed?: number;
  error?: string;
}

const EXAMPLE_PAYLOAD = JSON.stringify({
  network: 'arbitrum-one',
  agent_address: '0x0000000000000000000000000000000000000001',
  transactions: [
    {
      to: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506',
      data: '0x38ed1739000000000000000000000000000000000000000000000000002386f26fc10000',
      value: '0',
    },
  ],
  max_slippage_tolerance: 2.0,
}, null, 2);

const DANGEROUS_FLAGS = new Set(['execution_reverted', 'sandwich_detected', 'sig_failed', 'valid_until_expired', 'stylus_ink_overflow']);

// ── Sub-components defined at module level (not inline) ──────────────────

function StatusBadge({ status }: { status: SimulationResult['status'] }) {
  const styles: Record<SimulationResult['status'], string> = {
    APPROVED: 'bg-teal-950/60 border-teal-600/30 text-teal-300',
    REJECTED: 'bg-red-950/60 border-red-600/30 text-red-300',
    PENDING:  'bg-amber-950/60 border-amber-600/30 text-amber-300',
    ERROR:    'bg-zinc-900 border-zinc-700 text-zinc-400',
  };
  const icons: Record<SimulationResult['status'], string> = {
    APPROVED: '✓', REJECTED: '✗', PENDING: '⟳', ERROR: '!',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-mono font-medium ${styles[status]}`}>
      <span className={status === 'PENDING' ? 'animate-spin-slow' : ''}>{icons[status]}</span>
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

function KVRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between px-4 py-2.5 rounded-md border text-sm ${
      highlight ? 'border-amber/30 bg-amber-950/20' : 'border-border bg-surface'
    }`}>
      <span className="font-mono text-text-secondary">{label}</span>
      <span className={`font-mono ${highlight ? 'text-amber' : 'text-text-primary'}`}>{value}</span>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────

type Tab = 'flags' | 'gas' | 'timeboost' | 'raw';

export default function DashboardPage() {
  const [payload, setPayload] = useState(EXAMPLE_PAYLOAD);
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('flags');

  const simulate = useCallback(async () => {
    if (!apiKey.trim()) {
      alert('Enter your API key above.');
      return;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      setResult({ status: 'ERROR', error: 'Invalid JSON in request payload.' });
      return;
    }

    setLoading(true);
    setResult({ status: 'PENDING' });

    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
        setResult({ status: 'ERROR', error: errData?.error?.message ?? `HTTP ${res.status}` });
        return;
      }

      const data = await res.json() as SimulationResult & { session_id?: string };

      // Map session_id → sessionId if backend returns snake_case
      const sessionId = data.sessionId ?? data.session_id;

      if (sessionId && data.status === 'PENDING') {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 1000));
          const poll = await fetch(`${CF_WORKER_URL}/api/v1/simulate/${sessionId}`, {
            headers: { 'X-API-Key': apiKey },
          }).catch(() => null);
          if (!poll?.ok) continue;
          const pollData = await poll.json() as SimulationResult;
          if (pollData.status !== 'PENDING') {
            setResult(pollData);
            return;
          }
        }
        setResult({ status: 'ERROR', error: 'Simulation timed out after 30 seconds.' });
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network error';
      setResult({ status: 'ERROR', error: msg });
    } finally {
      setLoading(false);
    }
  }, [payload, apiKey]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-text-primary">Live simulation demo</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal animate-pulse-dot" />
            <span className="text-xs text-text-tertiary font-mono">Arbitrum One fork</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input panel */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">API Key</label>
              <input
                type="text"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="ask_free_••••••••••••"
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Transaction payload (JSON)</label>
              <textarea
                value={payload}
                onChange={e => setPayload(e.target.value)}
                rows={16}
                spellCheck={false}
                className="w-full px-4 py-3 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm resize-none focus:outline-none focus:border-coral/50 transition-colors leading-relaxed"
              />
            </div>
            <button
              onClick={simulate}
              disabled={loading}
              className="w-full py-3.5 bg-coral text-white rounded-lg font-medium text-sm hover:bg-coral/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.99] shadow-lg shadow-coral/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Simulating...
                </>
              ) : 'Run simulation'}
            </button>
            <p className="text-xs text-text-tertiary text-center">
              No real transaction is submitted. This runs against an ephemeral Arbitrum fork.
            </p>
          </div>

          {/* Results panel */}
          <div>
            {!result ? (
              <div className="rounded-xl border border-border bg-surface h-full flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
                <div className="w-12 h-12 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center text-coral text-2xl">⬡</div>
                <p className="text-text-primary font-medium">Results appear here</p>
                <p className="text-sm text-text-tertiary max-w-xs">Paste a transaction payload, add your API key, and hit Run simulation.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface overflow-hidden animate-slide-up">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <StatusBadge status={result.status} />
                  {result.sessionId && (
                    <span className="text-xs font-mono text-text-tertiary">{result.sessionId.slice(0, 8)}…</span>
                  )}
                </div>

                {result.status === 'ERROR' && (
                  <div className="px-6 py-6">
                    <p className="text-red-400 text-sm font-mono">{result.error}</p>
                  </div>
                )}

                {result.status === 'PENDING' && (
                  <div className="px-6 py-10 flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
                    <p className="text-sm text-text-secondary">Fork spawning, executing transaction…</p>
                  </div>
                )}

                {(result.status === 'APPROVED' || result.status === 'REJECTED') && (
                  <>
                    <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                      {[
                        { label: 'Gas cost',   value: result.gasCostEth ? `${result.gasCostEth} ETH` : '—' },
                        { label: 'Slippage',   value: result.slippagePercent != null ? `${result.slippagePercent.toFixed(2)}%` : '—' },
                        { label: 'Stylus ink', value: result.stylusInkConsumed ? `${(result.stylusInkConsumed / 1000).toFixed(1)}k` : '0' },
                      ].map(s => (
                        <div key={s.label} className="px-4 py-3 text-center">
                          <p className="text-xs text-text-tertiary mb-1">{s.label}</p>
                          <p className="text-sm font-mono font-medium text-text-primary">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    {result.revertReason && (
                      <div className="mx-6 mt-4 px-4 py-3 rounded-lg bg-red-950/30 border border-red-800/30">
                        <p className="text-xs text-text-tertiary mb-1">Revert reason</p>
                        <p className="text-sm font-mono text-red-300">{result.revertReason}</p>
                      </div>
                    )}

                    <div className="px-6 pt-4">
                      <div className="flex gap-1 border-b border-border mb-4">
                        {(['flags', 'gas', 'timeboost', 'raw'] as const).map(t => (
                          <button key={t} onClick={() => setTab(t)}
                            className={`px-3 py-2 text-xs font-mono capitalize border-b-2 transition-colors -mb-px ${
                              tab === t ? 'border-coral text-coral' : 'border-transparent text-text-tertiary hover:text-text-secondary'
                            }`}>{t}</button>
                        ))}
                      </div>

                      {tab === 'flags' && result.flags && (
                        <div className="space-y-1.5 pb-6">
                          {Object.entries(result.flags).map(([k, v]) => <FlagRow key={k} flagKey={k} value={v} />)}
                        </div>
                      )}

                      {tab === 'gas' && result.gasBreakdown && (
                        <div className="space-y-1.5 pb-6">
                          {Object.entries(result.gasBreakdown).map(([k, v]) => (
                            <KVRow key={k} label={k} value={String(v)} />
                          ))}
                        </div>
                      )}

                      {tab === 'timeboost' && result.timeboost && (
                        <div className="space-y-1.5 pb-6">
                          {Object.entries(result.timeboost).map(([k, v]) => (
                            <KVRow key={k} label={k} value={String(v)}
                              highlight={k === 'timeboost_fastlane_recommended' && Boolean(v)} />
                          ))}
                        </div>
                      )}

                      {tab === 'raw' && (
                        <div className="pb-6">
                          <pre className="text-xs font-mono text-text-secondary overflow-auto rounded-lg bg-elevated border border-border p-4 max-h-64">
                            {JSON.stringify(result, null, 2)}
                          </pre>
                        </div>
                      )}
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
