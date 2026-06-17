'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://arbisimguard.vercel.app';

interface TraceLog {
  depth: number;
  op: string;
  gas: number;
  gasCost: number;
  pc?: number;
}

interface RiskFlag {
  key: string;
  active: boolean;
  severity: 'HIGH' | 'MED' | 'LOW';
  description: string;
}

interface SimData {
  sessionId: string;
  status: string;
  network: string;
  agent_address: string;
  created_at: string;
  revertReason: string | null;
  gasCostEth: string;
  netPnlUsd: string;
  slippagePercent: number;
  flags: Record<string, boolean> | null;
  gasBreakdown: {
    l2_gas_used: number;
    l1_gas_buffer?: number;
    host_io_penalty_gas?: number;
    total_fees_wei: string;
  } | null;
  timeboost: {
    vulnerability_status: string;
    mev_sandwich_risk_score: number;
    timeboost_fastlane_recommended: boolean;
  } | null;
  executionTraces: TraceLog[];
}

const FLAG_META: Record<string, { severity: 'HIGH' | 'MED' | 'LOW'; description: string }> = {
  execution_reverted:    { severity: 'HIGH', description: 'Transaction would revert on-chain.' },
  sandwich_detected:     { severity: 'HIGH', description: 'MEV sandwich attack risk detected.' },
  sig_failed:            { severity: 'HIGH', description: 'Signature validation failed.' },
  valid_until_expired:   { severity: 'HIGH', description: 'UserOperation validity window has expired.' },
  stylus_ink_overflow:   { severity: 'HIGH', description: 'Stylus WASM ink limit exceeded.' },
  high_slippage:         { severity: 'MED',  description: 'Slippage exceeds 2% tolerance.' },
  unsafe_allowance:      { severity: 'MED',  description: 'Unlimited ERC-20 allowance detected.' },
  timeboost_recommended: { severity: 'LOW',  description: 'Timeboost fastlane recommended to avoid MEV.' },
};

const SEVERITY_STYLE: Record<'HIGH' | 'MED' | 'LOW', string> = {
  HIGH: 'text-red-400 bg-red-950/30 border-red-800/40',
  MED:  'text-amber-400 bg-amber-950/30 border-amber-800/40',
  LOW:  'text-sky-400 bg-sky-950/30 border-sky-800/40',
};

export default function ExplorerPage() {
  const searchParams = useSearchParams();
  const jobId = searchParams.get('jobId');
  const [apiKey, setApiKey] = useState('');
  const [data, setData] = useState<SimData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('arbisim_api_key') ?? '';
    setApiKey(stored.trim().replace(/[^\x20-\x7E]/g, ''));
  }, []);

  useEffect(() => {
    if (!jobId || !apiKey) return;
    setLoading(true);
    setError(null);
    fetch(`${CF_WORKER_URL}/api/v1/simulate/${jobId}`, {
      headers: { 'X-API-Key': apiKey },
    })
      .then(r => r.json())
      .then((json: any) => {
        if (json.error) throw new Error(typeof json.error === 'string' ? json.error : JSON.stringify(json.error));
        setData(json as SimData);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [jobId, apiKey]);

  const copyPermalink = () => {
    navigator.clipboard.writeText(`${SITE_URL}/share/${jobId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const activeFlags: RiskFlag[] = data?.flags
    ? Object.entries(data.flags)
        .filter(([, v]) => v)
        .map(([k]) => ({
          key: k,
          active: true,
          severity: FLAG_META[k]?.severity ?? 'LOW',
          description: FLAG_META[k]?.description ?? k,
        }))
        .sort((a, b) => ({ HIGH: 0, MED: 1, LOW: 2 }[a.severity] - { HIGH: 0, MED: 1, LOW: 2 }[b.severity]))
    : [];

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text-primary">Simulation Explorer</h1>
          {jobId && <p className="font-mono text-xs text-text-secondary mt-1">{jobId}</p>}
        </div>
        <div className="flex gap-2">
          {jobId && (
            <button
              onClick={copyPermalink}
              className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface text-text-secondary hover:text-text-primary transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Permalink'}
            </button>
          )}
          <Link
            href="/dashboard/logs"
            className="px-3 py-1.5 text-sm rounded-md border border-border bg-surface text-text-secondary hover:text-text-primary transition-colors"
          >
            Back to Logs
          </Link>
        </div>
      </div>

      {!jobId && (
        <div className="border border-border rounded-xl p-8 text-center text-text-secondary">
          <p className="text-sm">Open this page from the Logs view by clicking on a simulation row.</p>
          <p className="text-xs mt-2 font-mono text-text-secondary/50">?jobId=&#123;uuid&#125;</p>
        </div>
      )}

      {jobId && loading && (
        <div className="border border-border rounded-xl p-8 text-center text-text-secondary text-sm animate-pulse">
          Loading simulation data...
        </div>
      )}

      {error && (
        <div className="border border-red-800/40 rounded-xl p-4 bg-red-950/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Status', value: data.status, highlight: data.status === 'REJECTED' },
              { label: 'Network', value: data.network },
              { label: 'Gas Cost', value: data.gasCostEth ? `${parseFloat(data.gasCostEth).toFixed(6)} ETH` : '—' },
              { label: 'Net P&L', value: data.netPnlUsd ?? '—', highlight: parseFloat(data.netPnlUsd ?? '0') < 0 },
            ].map(({ label, value, highlight }) => (
              <div key={label} className="border border-border rounded-lg p-4 bg-surface">
                <p className="text-xs text-text-secondary mb-1">{label}</p>
                <p className={`font-mono text-sm font-semibold ${highlight ? 'text-red-400' : 'text-text-primary'}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Risk Flags */}
          {activeFlags.length > 0 && (
            <section className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface/50">
                <h2 className="text-sm font-semibold text-text-primary">Risk Flags ({activeFlags.length})</h2>
              </div>
              <div className="divide-y divide-border">
                {activeFlags.map(flag => (
                  <div key={flag.key} className="flex items-center gap-3 px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${SEVERITY_STYLE[flag.severity]}`}>
                      {flag.severity}
                    </span>
                    <span className="font-mono text-sm text-text-primary">{flag.key}</span>
                    <span className="text-xs text-text-secondary ml-auto">{flag.description}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gas Breakdown */}
          {data.gasBreakdown && (
            <section className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface/50">
                <h2 className="text-sm font-semibold text-text-primary">Gas Breakdown</h2>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: 'L2 Gas Used',       value: String(data.gasBreakdown.l2_gas_used) },
                  ...(data.gasBreakdown.l1_gas_buffer != null
                    ? [{ label: 'L1 Calldata Buffer', value: data.gasBreakdown.l1_gas_buffer!.toFixed(2) }]
                    : []),
                  ...(data.gasBreakdown.host_io_penalty_gas != null
                    ? [{ label: 'Host I/O Penalty Gas', value: String(data.gasBreakdown.host_io_penalty_gas) }]
                    : []),
                  { label: 'Total Fees (wei)', value: data.gasBreakdown.total_fees_wei },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-text-secondary">{label}</span>
                    <span className="font-mono text-text-primary">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* MEV / Timeboost */}
          {data.timeboost && (
            <section className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface/50">
                <h2 className="text-sm font-semibold text-text-primary">MEV / Timeboost</h2>
              </div>
              <div className="divide-y divide-border">
                {[
                  { label: 'Vulnerability',        value: data.timeboost.vulnerability_status },
                  { label: 'Sandwich Risk Score',  value: String(data.timeboost.mev_sandwich_risk_score) },
                  { label: 'Timeboost Recommended', value: data.timeboost.timeboost_fastlane_recommended ? 'Yes' : 'No' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between px-4 py-2.5 text-sm">
                    <span className="text-text-secondary">{label}</span>
                    <span className="font-mono text-text-primary">{value}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Execution Trace */}
          {data.executionTraces && data.executionTraces.length > 0 && (
            <section className="border border-border rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-border bg-surface/50 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-text-primary">
                  Execution Trace ({data.executionTraces.length} opcodes)
                </h2>
                <span className="text-xs text-text-secondary">Showing first 200</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-border bg-surface/30">
                      {['Depth', 'Op', 'Gas', 'Gas Cost'].map(h => (
                        <th key={h} className="px-4 py-2 text-left text-text-secondary font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {data.executionTraces.slice(0, 200).map((log, idx) => (
                      <tr key={idx} className="hover:bg-surface/40 transition-colors">
                        <td className="px-4 py-1.5 text-text-secondary">{log.depth}</td>
                        <td className="px-4 py-1.5 text-teal font-semibold">{log.op}</td>
                        <td className="px-4 py-1.5 text-text-primary">{log.gas}</td>
                        <td className="px-4 py-1.5 text-text-primary">{log.gasCost}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Re-run on other chains */}
          <section className="border border-border rounded-xl p-4">
            <h2 className="text-sm font-semibold text-text-primary mb-3">Re-run on Another Chain</h2>
            <div className="flex flex-wrap gap-2">
              {['arbitrum-one', 'ethereum', 'bnb', 'avalanche'].map(chain => (
                <Link
                  key={chain}
                  href={`/dashboard/simulate?prefill=${encodeURIComponent(JSON.stringify({
                    network: chain,
                    agent_address: data.agent_address,
                  }))}`}
                  className="px-3 py-1.5 text-xs rounded-md border border-border bg-surface text-text-secondary hover:text-text-primary hover:border-teal/40 transition-colors font-mono"
                >
                  {chain}
                </Link>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
