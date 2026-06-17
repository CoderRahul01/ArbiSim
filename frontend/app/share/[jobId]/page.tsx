import Link from 'next/link';

const GATEWAY_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001';

async function getSimulation(jobId: string) {
  try {
    const res = await fetch(`${GATEWAY_URL}/api/v1/sim/public/${jobId}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function SharePage({ params }: { params: { jobId: string } }) {
  const { jobId } = params;
  const data = await getSimulation(jobId);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="font-semibold text-text-primary text-sm tracking-tight">
            ArbiSim Guard
          </Link>
          <span className="text-text-secondary/40 text-sm">/</span>
          <span className="text-text-secondary text-sm font-mono">{jobId.slice(0, 8)}…</span>
        </div>
        <Link
          href="/dashboard/simulate"
          className="px-4 py-1.5 rounded-md bg-teal text-background text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Run Your Own
        </Link>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-10 space-y-6">
        {!data ? (
          <div className="border border-border rounded-xl p-8 text-center text-text-secondary">
            <p className="text-sm">Simulation not found or still processing.</p>
            <p className="font-mono text-xs mt-2 text-text-secondary/50">{jobId}</p>
          </div>
        ) : (
          <>
            {/* Status banner */}
            <div className={`rounded-xl border p-5 ${
              data.status === 'APPROVED'
                ? 'border-teal-600/30 bg-teal-950/20'
                : data.status === 'REJECTED'
                ? 'border-red-600/30 bg-red-950/20'
                : 'border-border bg-surface'
            }`}>
              <div className="flex items-center gap-3">
                <span className={`text-2xl font-bold ${
                  data.status === 'APPROVED' ? 'text-teal-400' :
                  data.status === 'REJECTED' ? 'text-red-400' : 'text-text-secondary'
                }`}>
                  {data.status === 'APPROVED' ? '✓' : data.status === 'REJECTED' ? '✗' : '⟳'}
                </span>
                <div>
                  <p className="font-semibold text-text-primary">{data.status}</p>
                  <p className="text-xs text-text-secondary font-mono">{data.network} · {data.agent_address?.slice(0, 10)}…</p>
                </div>
              </div>
              {data.revertReason && (
                <p className="mt-3 text-sm text-red-300 font-mono break-all">{data.revertReason}</p>
              )}
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Gas Cost', value: data.gasCostEth ? `${parseFloat(data.gasCostEth).toFixed(6)} ETH` : '—' },
                { label: 'Net P&L',  value: data.netPnlUsd ?? '—' },
                { label: 'Slippage', value: data.slippagePercent != null ? `${data.slippagePercent}%` : '—' },
                { label: 'Chain',    value: data.network ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="border border-border rounded-lg p-4 bg-surface">
                  <p className="text-xs text-text-secondary mb-1">{label}</p>
                  <p className="font-mono text-sm font-semibold text-text-primary">{value}</p>
                </div>
              ))}
            </div>

            {/* Active Flags */}
            {data.flags && Object.values(data.flags).some(Boolean) && (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-surface/50">
                  <h2 className="text-sm font-semibold text-text-primary">Risk Flags</h2>
                </div>
                <div className="divide-y divide-border">
                  {Object.entries(data.flags as Record<string, boolean>)
                    .filter(([, v]) => v)
                    .map(([k]) => (
                      <div key={k} className="flex items-center px-4 py-2.5 gap-3">
                        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" />
                        <span className="font-mono text-sm text-text-primary">{k}</span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* CTA */}
            <div className="border border-border rounded-xl p-6 text-center space-y-3">
              <p className="text-text-secondary text-sm">
                Pre-flight simulate your own agent transactions on Arbitrum, Ethereum, BNB, and Avalanche.
              </p>
              <Link
                href="/dashboard/simulate"
                className="inline-block px-6 py-2 rounded-lg bg-teal text-background text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Start Free — No Wallet Required
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
