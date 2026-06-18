import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import ShareButton from './ShareButton';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';
const ARBISCAN_SEPOLIA = 'https://sepolia.arbiscan.io/address/';

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
}

// ── Metadata ────────────────────────────────────────────────────────────────

export async function generateMetadata(
  { params }: { params: Promise<{ sessionId: string }> }
): Promise<Metadata> {
  const { sessionId } = await params;
  const short = sessionId.slice(0, 8);
  return {
    title: `Simulation ${short}… — ArbiSim Guard`,
    description: 'Pre-flight EVM simulation result — ArbiSim Guard',
    openGraph: {
      title: `Simulation result — ArbiSim Guard`,
      description: 'View this transaction pre-flight simulation result',
    },
  };
}

// ── Sub-components ──────────────────────────────────────────────────────────

const DANGEROUS_FLAGS = new Set(['execution_reverted', 'sandwich_detected', 'sig_failed', 'valid_until_expired', 'stylus_ink_overflow']);

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

function GasBreakdownPanel({ breakdown }: { breakdown: GasBreakdown }) {
  const totalEth = breakdown.total_fees_wei
    ? (Number(BigInt(breakdown.total_fees_wei)) / 1e18).toFixed(8)
    : null;
  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Gas breakdown</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        {[
          { label: 'L2 gas used',        value: breakdown.l2_gas_used?.toLocaleString() ?? '—' },
          { label: 'L1 buffer',          value: breakdown.l1_gas_buffer?.toLocaleString() ?? '—' },
          { label: 'Host I/O penalty',   value: breakdown.host_io_penalty_gas?.toLocaleString() ?? '—' },
          { label: 'Total fees',         value: totalEth ? `${totalEth} ETH` : '—' },
        ].map(({ label, value }) => (
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

  const registryAddress = process.env.SIMULATION_REGISTRY_ADDRESS ?? '';

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
                { label: 'Gas cost',     value: sim.gasCostEth ? `${sim.gasCostEth} ETH` : '—' },
                { label: 'Slippage',     value: sim.slippagePercent != null ? `${sim.slippagePercent.toFixed(2)}%` : '—' },
                { label: 'Net P&L',      value: sim.netPnlUsd ?? '—' },
                { label: 'Stylus ink',   value: sim.stylusInkConsumed != null ? sim.stylusInkConsumed.toLocaleString() : '—' },
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
            {sim.gasBreakdown && <GasBreakdownPanel breakdown={sim.gasBreakdown} />}

            {/* Flags grid */}
            {sim.flags && (
              <div className="rounded-xl border border-border bg-surface p-6">
                <h3 className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Security flags</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {Object.entries(sim.flags).map(([k, v]) => <FlagRow key={k} flagKey={k} value={v} />)}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="rounded-xl border border-border bg-surface p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                {registryAddress && (
                  <a
                    href={`${ARBISCAN_SEPOLIA}${registryAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-mono text-coral hover:text-coral-hover transition-colors inline-flex items-center gap-1"
                  >
                    Verified on-chain at Arbiscan Sepolia ↗
                  </a>
                )}
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
