import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ShareButton from './ShareButton';
import ViewTracker from './ViewTracker';
import { SUPPORTED_NETWORKS } from '../../../lib/chains';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

// Registry addresses per network (server-side env vars, safe in Server Components)
const REGISTRY_BY_NETWORK: Record<string, string> = {
  'arbitrum-one':      process.env.SIMULATION_REGISTRY_ADDRESS ?? '',
  'arbitrum-sepolia':  process.env.ARBITRUM_SEPOLIA_REGISTRY   ?? process.env.SIMULATION_REGISTRY_ADDRESS ?? '',
  'avalanche-mainnet': process.env.AVALANCHE_MAINNET_REGISTRY  ?? '',
  'avalanche-fuji':    process.env.AVALANCHE_FUJI_REGISTRY     ?? '',
};

function explorerUrl(network: string, address: string): string {
  const chain = SUPPORTED_NETWORKS[network];
  const base = chain?.blockExplorer ?? '';
  return base ? `${base}/address/${address}` : '';
}

function explorerLabel(network: string): string {
  const chain = SUPPORTED_NETWORKS[network];
  if (chain?.displayName?.includes('Avalanche')) return 'Snowscan';
  if (chain?.displayName?.includes('Sepolia')) return 'Arbiscan Sepolia';
  return 'Arbiscan';
}

function nativeToken(network: string): string {
  const chain = SUPPORTED_NETWORKS[network];
  return chain?.nativeToken ?? 'ETH';
}

// ── Types ──────────────────────────────────────────────────────────────────

interface GasBreakdown {
  l2_gas_used?: number;
  l1_gas_buffer?: number | null;
  host_io_penalty_gas?: number;
  total_fees_wei?: string;
}

interface TimeboostData {
  vulnerability_status: string;
  mev_sandwich_risk_score: number;
  timeboost_fastlane_recommended: boolean;
  estimated_timeboost_premium_wei: string;
}

interface PublicSimResult {
  session_id: string;
  network: string;
  status: 'APPROVED' | 'REJECTED';
  agent_address: string;
  created_at: string;
  gasCostEth: string;
  netPnlUsd: string;
  slippagePercent?: number;
  stylusInkConsumed: number;
  revertReason: string | null;
  flags: Record<string, boolean> | null;
  gasBreakdown?: GasBreakdown;
  timeboost?: TimeboostData;
  topOpcodes?: Array<{ op: string; gas: number }>;
  balanceTraces?: Array<any>;
  tokenTransfers?: Array<any>;
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Metadata> {
  const { sessionId } = await params;
  const short = sessionId.slice(0, 8);
  return {
    title: `Simulation ${short}... - ArbiSim Guard`,
    description: 'Pre-flight EVM simulation result - ArbiSim Guard',
    openGraph: {
      title: 'Simulation result - ArbiSim Guard',
      description: 'View this transaction pre-flight simulation result',
    },
  };
}

// ── Sub-components ──────────────────────────────────────────────────────────

const DANGEROUS_FLAGS = new Set([
  'execution_reverted', 'sandwich_detected', 'sig_failed',
  'valid_until_expired', 'stylus_ink_overflow',
  'low_agent_reputation', 'x402_payment_risk',
]);

const FLAG_ICONS: Record<string, React.ReactNode> = {
  execution_reverted:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  high_slippage:         <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  sandwich_detected:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="8" y="14" width="8" height="7" rx="1"/><line x1="6.5" y1="10" x2="12" y2="14"/><line x1="17.5" y1="10" x2="12" y2="14"/></svg>,
  unsafe_allowance:      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  sig_failed:            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/><line x1="12" y1="15" x2="12" y2="18"/></svg>,
  valid_until_expired:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  timeboost_recommended: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  stylus_ink_overflow:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>,
  low_agent_reputation:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="18" y1="8" x2="23" y2="13"/><line x1="23" y1="8" x2="18" y2="13"/></svg>,
  x402_payment_risk:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="12" y1="12" x2="12" y2="23"/><line x1="12" y1="1" x2="12" y2="7"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>,
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    APPROVED: 'bg-teal-950/60 border-teal-600/30 text-teal-300',
    REJECTED: 'bg-red-950/60 border-red-600/30 text-red-300',
  };
  const icons: Record<string, string> = { APPROVED: '✓', REJECTED: '✗' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-mono font-medium ${styles[status] ?? 'bg-zinc-900 border-zinc-700 text-zinc-400'}`}>
      {icons[status] ?? '?'} {status}
    </span>
  );
}

function FlagRow({ flagKey, value }: { flagKey: string; value: boolean }) {
  const isDangerous = DANGEROUS_FLAGS.has(flagKey) && value;
  const isWarning   = !DANGEROUS_FLAGS.has(flagKey) && value;
  const icon = FLAG_ICONS[flagKey] ?? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="10"/>
      <line x1="12" y1="16" x2="12" y2="12"/>
      <line x1="12" y1="8" x2="12.01" y2="8"/>
    </svg>
  );
  const label = flagKey.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

  return (
    <div className={`flex items-center justify-between px-4 py-2.5 rounded-md border transition-colors ${
      isDangerous ? 'border-red-800/30 bg-red-950/20 text-red-200' :
      isWarning   ? 'border-amber-800/30 bg-amber-950/20 text-amber-200' :
      'border-zinc-800/40 bg-zinc-900/10 text-zinc-300'
    }`}>
      <div className="flex items-center gap-2.5">
        <span className={isDangerous ? 'text-red-400' : isWarning ? 'text-amber-400' : 'text-zinc-500'}>
          {icon}
        </span>
        <span className="font-mono text-sm">{label}</span>
      </div>
      <span className={`text-xs font-mono px-2 py-0.5 rounded ${value ? (isDangerous ? 'bg-red-900/40 text-red-300' : 'bg-amber-900/40 text-amber-300') : 'bg-teal-950/40 text-teal-300'}`}>
        {value ? 'Risk Detected' : 'Safe'}
      </span>
    </div>
  );
}

function GasBreakdownPanel({ breakdown, network }: { breakdown: GasBreakdown; network: string }) {
  const token = nativeToken(network);
  const totalFormatted = breakdown.total_fees_wei
    ? (Number(BigInt(breakdown.total_fees_wei)) / 1e18).toFixed(8)
    : null;

  // Only show L1 buffer row for chains that have L1 data fees
  const hasL1Fee = breakdown.l1_gas_buffer != null && breakdown.l1_gas_buffer > 0;

  const rows: Array<{ label: string; value: string }> = [
    { label: 'Gas used',        value: breakdown.l2_gas_used?.toLocaleString() ?? '-' },
    ...(hasL1Fee ? [{ label: 'L1 buffer', value: breakdown.l1_gas_buffer!.toLocaleString() }] : []),
    { label: 'Host I/O penalty', value: breakdown.host_io_penalty_gas?.toLocaleString() ?? '0' },
    { label: 'Total fees',       value: totalFormatted ? `${totalFormatted} ${token}` : '-' },
  ];

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Gas breakdown</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        {rows.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-text-tertiary">{label}</p>
            <p className="font-mono text-text-primary mt-0.5">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Server Component ────────────────────────────────────────────────────────

export default async function PublicSimPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;

  let sim: PublicSimResult | null = null;
  let fetchError = '';

  try {
    const res = await fetch(`${CF_WORKER_URL}/api/v1/sim/public/${sessionId}`, {
      cache: 'no-store',
    });
    if (res.ok) {
      sim = await res.json() as PublicSimResult;
    } else {
      const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
      fetchError = err?.error?.message ?? `Simulation not found (HTTP ${res.status})`;
    }
  } catch {
    fetchError = 'Unable to reach the ArbiSim Guard API.';
  }

  // Pick the right registry address for the session's chain
  const registryAddress = sim ? (REGISTRY_BY_NETWORK[sim.network] ?? '') : '';

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <header className="border-b border-border bg-surface/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="ArbiSim Guard" width={24} height={24} className="rounded-md shrink-0 shadow-sm shadow-coral/30" />
            <span className="font-semibold text-text-primary text-sm">ArbiSim Guard</span>
          </div>
          <span className="text-xs text-text-tertiary font-mono">Simulation result</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-10">
        {fetchError ? (
          <div className="rounded-xl border border-border bg-surface p-10 text-center">
            <p className="text-red-400 font-mono text-sm mb-4">{fetchError}</p>
            <Link href="/dashboard" className="text-coral text-sm hover:text-coral-hover transition-colors">
              ← Go to dashboard
            </Link>
          </div>
        ) : sim ? (
          <div className="space-y-6 animate-fade-in">
            <ViewTracker sessionId={sessionId} />
            {/* Header card */}
            <div className="rounded-xl border border-border bg-surface p-6">
              <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                <StatusBadge status={sim.status} />
                <span className="text-xs font-mono text-text-tertiary">{sim.session_id}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-text-tertiary">Network</p>
                  <p className="font-mono text-text-primary">{sim.network}</p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary">Agent</p>
                  <p className="font-mono text-text-primary truncate">{sim.agent_address}</p>
                </div>
                <div>
                  <p className="text-xs text-text-tertiary">Created</p>
                  <p className="font-mono text-text-primary">{new Date(sim.created_at).toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: `Gas cost (${nativeToken(sim.network)})`, value: sim.gasCostEth ? `${sim.gasCostEth}` : '-' },
                { label: 'Slippage',                               value: sim.slippagePercent != null ? `${sim.slippagePercent.toFixed(2)}%` : '-' },
                { label: 'Net P&L',                                value: sim.netPnlUsd ?? '-' },
                { label: 'Stylus ink',                             value: sim.stylusInkConsumed != null ? sim.stylusInkConsumed.toLocaleString() : '-' },
              ].map(s => (
                <div key={s.label} className="rounded-lg border border-border bg-surface px-4 py-3">
                  <p className="text-xs text-text-tertiary font-mono uppercase tracking-wider mb-1">{s.label}</p>
                  <p className="text-lg font-mono font-semibold text-text-primary">{s.value}</p>
                </div>
              ))}
            </div>

            {sim.revertReason && (
              <div className="rounded-lg px-4 py-3 bg-red-950/30 border border-red-800/30">
                <p className="text-xs text-text-tertiary mb-1">Revert reason</p>
                <p className="text-sm font-mono text-red-300">{sim.revertReason}</p>
              </div>
            )}

            {/* Gas breakdown */}
            {sim.gasBreakdown && (
              <GasBreakdownPanel breakdown={sim.gasBreakdown} network={sim.network} />
            )}

            {/* Flags grid */}
            {sim.flags && (
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Security flags</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Object.entries(sim.flags).map(([k, v]) => <FlagRow key={k} flagKey={k} value={v} />)}
                </div>
              </div>
            )}

            {/* Top Opcodes trace */}
            {sim.topOpcodes && sim.topOpcodes.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-6">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest select-none">
                      Gas Consumption by Opcode (Top 10)
                    </h3>
                    <span className="text-text-tertiary transition-transform group-open:rotate-180">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-4 space-y-2">
                    <div className="grid grid-cols-2 text-xs font-mono text-text-tertiary border-b border-border pb-1.5 mb-1.5">
                      <div>Opcode</div>
                      <div className="text-right">Gas Cost</div>
                    </div>
                    {sim.topOpcodes.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-2 text-sm font-mono py-1 border-b border-border/40 last:border-0">
                        <div className="text-text-primary">{item.op}</div>
                        <div className="text-right text-text-secondary">{item.gas.toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Token Transfers */}
            {sim.tokenTransfers && sim.tokenTransfers.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-6">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest select-none">
                      Token Transfers ({sim.tokenTransfers.length})
                    </h3>
                    <span className="text-text-tertiary transition-transform group-open:rotate-180">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-4 space-y-2">
                    {sim.tokenTransfers.map((tx: any, idx: number) => (
                      <div key={idx} className="text-sm font-mono py-2 border-b border-border/40 last:border-0 flex flex-wrap justify-between items-center gap-2">
                        <div>
                          <span className="text-coral font-medium">{tx.symbol ?? 'Token'}</span>{' '}
                          <span className="text-text-secondary">{(Number(tx.amount) / Math.pow(10, tx.decimals ?? 18)).toLocaleString()}</span>
                        </div>
                        <div className="text-xs text-text-tertiary">
                          From <span className="text-text-secondary">{tx.from?.slice(0, 6)}...{tx.from?.slice(-4)}</span> to{' '}
                          <span className="text-text-secondary">{tx.to?.slice(0, 6)}...{tx.to?.slice(-4)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            )}

            {/* Balance Changes */}
            {sim.balanceTraces && sim.balanceTraces.length > 0 && (
              <div className="rounded-xl border border-border bg-surface p-6">
                <details className="group">
                  <summary className="flex items-center justify-between cursor-pointer list-none">
                    <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest select-none">
                      Balance Changes ({sim.balanceTraces.length})
                    </h3>
                    <span className="text-text-tertiary transition-transform group-open:rotate-180">
                      ▼
                    </span>
                  </summary>
                  <div className="mt-4 space-y-2">
                    {sim.balanceTraces.map((trace: any, idx: number) => {
                      const before = Number(trace.before ?? 0) / 1e18;
                      const after = Number(trace.after ?? 0) / 1e18;
                      const diff = after - before;
                      const diffFormatted = diff >= 0 ? `+${diff.toFixed(6)}` : diff.toFixed(6);
                      return (
                        <div key={idx} className="text-sm font-mono py-2 border-b border-border/40 last:border-0 flex flex-wrap justify-between items-center gap-2">
                          <div className="truncate max-w-[200px] sm:max-w-xs text-text-primary" title={trace.address}>
                            {trace.address.slice(0, 6)}...{trace.address.slice(-4)}
                          </div>
                          <div className={`font-medium ${diff >= 0 ? 'text-teal' : 'text-red-400'}`}>
                            {diffFormatted} {nativeToken(sim!.network)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              </div>
            )}

            {/* Footer */}
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                {registryAddress && (() => {
                  const url = explorerUrl(sim.network, registryAddress);
                  const label = explorerLabel(sim.network);
                  return url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-coral hover:text-coral-hover transition-colors inline-flex items-center gap-1"
                    >
                      Verified on-chain at {label} ↗
                    </a>
                  ) : null;
                })()}
                <p className="text-xs text-text-tertiary mt-1">
                  This simulation was independently verified by ArbiSim Guard.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <ShareButton sessionId={sessionId} />
                <Link
                  href="/dashboard"
                  className="px-5 py-2.5 bg-coral text-white rounded-lg font-medium text-sm hover:bg-coral/90 transition-all duration-200 shadow-lg shadow-coral/25"
                >
                  Run your own →
                </Link>
              </div>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
