'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

// ── Chain registry (mirrors gateway/src/chain-config.ts) ──────────────────
const SUPPORTED_NETWORKS = [
  { id: 'arbitrum-one',            label: 'Arbitrum One',            badge: null,  explorer: 'https://arbiscan.io' },
  { id: 'arbitrum-sepolia',        label: 'Arbitrum Sepolia',        badge: null,  explorer: 'https://sepolia.arbiscan.io' },
  { id: 'avalanche-mainnet',       label: 'Avalanche C-Chain',       badge: 'NEW', explorer: 'https://subnets.avax.network/c-chain' },
  { id: 'avalanche-fuji',          label: 'Avalanche Fuji Testnet',  badge: 'NEW', explorer: 'https://subnets-test.avax.network/c-chain' },
  { id: 'robinhood-chain-testnet', label: 'Robinhood Chain Testnet', badge: null,  explorer: '' },
] as const;

type NetworkId = typeof SUPPORTED_NETWORKS[number]['id'];

const EXAMPLE_PAYLOADS: Record<NetworkId, object> = {
  'arbitrum-one': {
    network: 'arbitrum-one',
    agent_address: '0x0000000000000000000000000000000000000001',
    transactions: [{ to: '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506', data: '0x38ed1739000000000000000000000000000000000000000000000000002386f26fc10000', value: '0' }],
    max_slippage_tolerance: 2.0,
  },
  'arbitrum-sepolia': {
    network: 'arbitrum-sepolia',
    agent_address: '0x0000000000000000000000000000000000000001',
    transactions: [{ to: '0x0000000000000000000000000000000000000002', data: '0x', value: '0' }],
    max_slippage_tolerance: 2.0,
  },
  'avalanche-mainnet': {
    network: 'avalanche-mainnet',
    agent_address: '0x0000000000000000000000000000000000000001',
    transactions: [{ to: '0x60aE616a2155Ee3d9A68541Ba4544862310933d4', data: '0x38ed1739000000000000000000000000000000000000000000000000002386f26fc10000', value: '0' }],
    max_slippage_tolerance: 2.0,
  },
  'avalanche-fuji': {
    network: 'avalanche-fuji',
    agent_address: '0x742d35Cc6634C0532925a3b8A4Bc454e4438f44e',
    transactions: [{ to: '0x5425890298aed601595a70AB815c96711a31Bc65', data: '0xa9059cbb000000000000000000000000742d35Cc6634C0532925a3b8A4Bc454e4438f44e0000000000000000000000000000000000000000000000000000000000989680', value: '0x0' }],
    max_slippage_tolerance: 0.5,
  },
  'robinhood-chain-testnet': {
    network: 'robinhood-chain-testnet',
    agent_address: '0x0000000000000000000000000000000000000001',
    transactions: [{ to: '0x0000000000000000000000000000000000000002', data: '0x', value: '0' }],
    max_slippage_tolerance: 2.0,
  },
};

// ── Types ─────────────────────────────────────────────────────────────────
interface SimulationResult {
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'ERROR';
  sessionId?: string;
  session_id?: string;
  revertReason?: string | null;
  gasCostEth?: string;
  slippagePercent?: number;
  flags?: Record<string, boolean>;
  gasBreakdown?: Record<string, string | number>;
  timeboost?: Record<string, string | number | boolean>;
  stylusInkConsumed?: number;
  network?: string;
  error?: string;
}

// Flags that are danger (red) when true
const DANGER_FLAGS = new Set(['execution_reverted', 'sandwich_detected', 'sig_failed', 'valid_until_expired', 'stylus_ink_overflow', 'low_agent_reputation', 'x402_payment_risk']);
// Flags that are warning (amber) when true
const WARNING_FLAGS = new Set(['high_slippage', 'timeboost_recommended', 'unsafe_allowance']);

// ── Sub-components ────────────────────────────────────────────────────────

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
      {icons[status]} {status}
    </span>
  );
}

function FlagRow({ flagKey, value }: { flagKey: string; value: boolean }) {
  const isDanger = DANGER_FLAGS.has(flagKey) && value;
  const isWarning = WARNING_FLAGS.has(flagKey) && value;
  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-md border transition-colors ${
      isDanger  ? 'border-red-800/30 bg-red-950/20' :
      isWarning ? 'border-amber-800/30 bg-amber-950/20' :
      'border-border bg-surface'
    }`}>
      <span className="font-mono text-sm text-text-secondary">{flagKey}</span>
      <span className={`text-sm font-medium ${
        isDanger ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-teal'
      }`}>
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

// ── Main page ─────────────────────────────────────────────────────────────

type Tab = 'flags' | 'gas' | 'timeboost' | 'raw';

export default function DashboardPage() {
  const [network, setNetwork] = useState<NetworkId>('arbitrum-one');
  const [payload, setPayload] = useState(JSON.stringify(EXAMPLE_PAYLOADS['arbitrum-one'], null, 2));
  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>('flags');
  const { address } = useAccount();

  // Load API key from localStorage on mount (sanitized)
  useEffect(() => {
    const stored = localStorage.getItem('arbisim_api_key') || '';
    setApiKey(stored.trim().replace(/[^\x20-\x7E]/g, ''));
  }, []);

  // Auto-populate agent_address from connected wallet (only replaces placeholder)
  useEffect(() => {
    if (!address) return;
    try {
      const parsed = JSON.parse(payload);
      if (parsed.agent_address === '0x0000000000000000000000000000000000000001') {
        setPayload(JSON.stringify({ ...parsed, agent_address: address }, null, 2));
      }
    } catch { /* leave as-is */ }
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stored = localStorage.getItem('arbisim_api_key') ?? '';
    setApiKey(stored.trim().replace(/[^\x20-\x7E]/g, ''));
  }, []);

  const handleNetworkChange = useCallback((newNetwork: NetworkId) => {
    setNetwork(newNetwork);
    setPayload(JSON.stringify(EXAMPLE_PAYLOADS[newNetwork], null, 2));
    setResult(null);
  }, []);

  const activeChain = SUPPORTED_NETWORKS.find(n => n.id === network)!;
  const isAvalanche = network.startsWith('avalanche');

  const simulate = useCallback(async () => {
    const cleanKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');
    if (!cleanKey) { alert('Enter your API key above.'); return; }

    let parsed: unknown;
    try { parsed = JSON.parse(payload); }
    catch { setResult({ status: 'ERROR', error: 'Invalid JSON in request payload.' }); return; }

    setLoading(true);
    setResult({ status: 'PENDING' });

    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cleanKey },
        body: JSON.stringify(parsed),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string | { message?: string } };
        const msg = typeof errData.error === 'string' ? errData.error : errData?.error?.message ?? `HTTP ${res.status}`;
        setResult({ status: 'ERROR', error: msg });
        return;
      }

      const data = await res.json() as SimulationResult;
      const sessionId = data.sessionId ?? data.session_id;

      if (sessionId && data.status === 'PENDING') {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const poll = await fetch(`${CF_WORKER_URL}/api/v1/simulate/${sessionId}`, {
            headers: { 'X-API-Key': cleanKey },
          }).catch(() => null);
          if (!poll?.ok) continue;
          const pollData = await poll.json() as SimulationResult;
          if (pollData.status !== 'PENDING') { setResult(pollData); return; }
        }
        setResult({ status: 'ERROR', error: 'Simulation timed out after 90 seconds.' });
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setResult({ status: 'ERROR', error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setLoading(false);
    }
  }, [payload, apiKey]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 h-14 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Live simulation</span>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-teal animate-pulse-dot" />
            <span className="text-xs text-text-tertiary font-mono">{activeChain.label} fork</span>
            {isAvalanche && (
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-orange-950/50 border border-orange-600/30 text-orange-400">
                Avalanche
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Input panel */}
          <div className="space-y-4">
            {/* Network selector */}
            <div>
              <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">Network</label>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_NETWORKS.map(n => (
                  <button
                    key={n.id}
                    onClick={() => handleNetworkChange(n.id)}
                    className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                      network === n.id
                        ? 'border-coral/60 bg-coral/10 text-coral'
                        : 'border-border bg-surface text-text-tertiary hover:border-coral/30 hover:text-text-secondary'
                    }`}
                  >
                    {n.label}
                    {n.badge && (
                      <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                        {n.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Avalanche hint */}
            {isAvalanche && (
              <div className="px-4 py-3 rounded-lg border border-orange-600/20 bg-orange-950/15 text-xs text-orange-300/80 font-mono">
                Avalanche fork: ERC-8004 reputation check + x402 payment safety. No Nitro gas math.
              </div>
            )}

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
                  Simulating on {activeChain.label}…
                </>
              ) : `Run simulation on ${activeChain.label}`}
            </button>

            <p className="text-xs text-text-tertiary text-center">
              No real transaction is submitted — runs against an ephemeral {activeChain.label} fork.
            </p>
          </div>

          {/* Results panel */}
          <div>
            {!result ? (
              <div className="rounded-xl border border-border bg-surface h-full flex flex-col items-center justify-center gap-4 py-20 text-center px-8">
                <div className="w-12 h-12 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center text-coral text-2xl">⬡</div>
                <p className="text-text-primary font-medium">Results appear here</p>
                <p className="text-sm text-text-tertiary max-w-xs">Select a network, paste a transaction payload, add your API key, and hit Run.</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-surface overflow-hidden animate-slide-up">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                  <StatusBadge status={result.status} />
                  <div className="flex items-center gap-3">
                    {result.network && (
                      <span className="text-xs font-mono text-text-tertiary">{result.network}</span>
                    )}
                    {result.sessionId && (
                      <span className="text-xs font-mono text-text-tertiary">{result.sessionId.slice(0, 8)}…</span>
                    )}
                  </div>
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
                          {Object.entries(result.flags).map(([k, v]) => (
                            <FlagRow key={k} flagKey={k} value={Boolean(v)} />
                          ))}
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

                    {(result.sessionId ?? result.session_id) && (
                      <div className="px-6 pb-4">
                        <Link
                          href={`/dashboard/simulate/${result.sessionId ?? result.session_id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-mono text-coral hover:text-coral-hover transition-colors"
                        >
                          View full explorer →
                        </Link>
                      </div>
                    )}
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
