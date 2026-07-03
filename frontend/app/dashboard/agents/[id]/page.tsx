'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

interface StressTestResultItem {
  test_name: string;
  passed: boolean;
  verdict: string;
  failure_injected: string;
  duration_ms: number;
  error?: string;
  gas_cost_eth?: string;
  net_pnl_usd?: string;
  slippage_detected?: string;
  revert_reason?: string;
}

interface AgentDetail {
  id: string;
  name: string;
  description?: string;
  network: string;
  spec: any;
  stress_status: string;
  latest_stress_id?: string;
  stress_results?: StressTestResultItem[];
  passed_all?: boolean;
  score?: string;
  deployment_tx?: string;
  deployed_at?: string;
  created_at: string;
}

export default function AgentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [launching, setLaunching] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deploySuccess, setDeploySuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  // Polling if stress test is RUNNING or PENDING
  useEffect(() => {
    if (!agent) return;
    if (agent.stress_status === 'PENDING' || agent.stress_status === 'RUNNING') {
      const interval = setInterval(fetchAgent, 3000);
      return () => clearInterval(interval);
    }
  }, [agent?.stress_status]);

  const fetchAgent = async () => {
    try {
      const raw = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
      const key = raw.trim().replace(/[^\x20-\x7E]/g, '') || 'demo';

      const res = await fetch(`${CF_WORKER_URL}/api/v1/agents/${agentId}`, {
        headers: { 'X-API-Key': key },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch agent (${res.status})`);
      }

      const data = await res.json();
      setAgent(data);
    } catch (err: any) {
      setError(err.message || 'Error loading agent detail');
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchStressTest = async () => {
    setLaunching(true);
    setError(null);
    try {
      const raw = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
      const key = raw.trim().replace(/[^\x20-\x7E]/g, '') || 'demo';

      const res = await fetch(`${CF_WORKER_URL}/api/v1/agents/${agentId}/stress-test`, {
        method: 'POST',
        headers: { 'X-API-Key': key },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to launch stress test');

      fetchAgent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLaunching(false);
    }
  };

  const handleDeploy = async () => {
    setDeploying(true);
    setError(null);
    try {
      const raw = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
      const key = raw.trim().replace(/[^\x20-\x7E]/g, '') || 'demo';

      const res = await fetch(`${CF_WORKER_URL}/api/v1/agents/${agentId}/deploy`, {
        method: 'POST',
        headers: { 'X-API-Key': key },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to deploy agent');

      setDeploySuccess(data.message || 'Agent deployed to mainnet!');
      fetchAgent();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400 space-y-3">
        <div className="inline-block w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm">Loading agent telemetry & stress suite...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-8 text-center text-rose-400 space-y-4">
        <p>Agent not found</p>
        <Link href="/dashboard/agents" className="text-xs text-white underline">
          ← Return to Agent Studio
        </Link>
      </div>
    );
  }

  const results = agent.stress_results || [];

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* Header & Nav */}
      <div className="space-y-1">
        <Link href="/dashboard/agents" className="text-xs text-slate-400 hover:text-white transition-colors">
          ← Back to Agent Studio
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
              {agent.name}
              {agent.deployment_tx ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  LIVE ON MAINNET
                </span>
              ) : agent.passed_all ? (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  VERIFIED ({agent.score || '6/6'})
                </span>
              ) : (
                <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {agent.stress_status}
                </span>
              )}
            </h1>
            <p className="text-slate-400 text-sm mt-1">{agent.description || 'No description provided.'}</p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleLaunchStressTest}
              disabled={launching || agent.stress_status === 'RUNNING'}
              className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium text-xs border border-white/10 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {launching || agent.stress_status === 'RUNNING' ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Running Suite...
                </>
              ) : (
                '▶ Run 6-Test Stress Suite'
              )}
            </button>

            <button
              onClick={handleDeploy}
              disabled={!agent.passed_all || deploying || !!agent.deployment_tx}
              title={!agent.passed_all ? 'Pass all 6 stress tests to unlock mainnet deployment' : ''}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-2 border ${
                agent.deployment_tx
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 opacity-80 cursor-default'
                  : agent.passed_all
                  ? 'bg-red-600 hover:bg-red-500 text-white border-red-400/20 shadow-lg shadow-red-950/40'
                  : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'
              }`}
            >
              {deploying ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deploying...
                </>
              ) : agent.deployment_tx ? (
                '✓ Deployed to Mainnet'
              ) : (
                '⚡ Deploy to Avalanche Mainnet'
              )}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {results?.[0]?.passed === false && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs space-y-1">
          <p className="font-semibold text-amber-200">⚠️ Baseline Control Test Failed</p>
          <p>
            The agent's transaction reverted during unmutated baseline execution ({results[0].revert_reason || 'Transaction reverted'}).
            Ensure your agent spec has valid contract targets and calldata. Subsequent failure injection tests are marked SKIPPED until baseline passes.
          </p>
        </div>
      )}

      {deploySuccess && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-sm">
          🎉 {deploySuccess}
        </div>
      )}

      {/* Agent Spec Summary Card */}
      <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-4">
        <h2 className="text-base font-semibold text-white">Agent Specification & Safety Gates</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-slate-500 block">Target Chain</span>
            <span className="font-medium text-slate-200">{agent.network}</span>
          </div>
          <div>
            <span className="text-slate-500 block">Max Slippage</span>
            <span className="font-medium text-slate-200">{agent.spec?.safety_gates?.max_slippage_pct}%</span>
          </div>
          <div>
            <span className="text-slate-500 block">Max Gas Cap</span>
            <span className="font-medium text-slate-200">{agent.spec?.safety_gates?.max_gas_cost_avax} AVAX</span>
          </div>
          <div>
            <span className="text-slate-500 block">Min P&L Floor</span>
            <span className="font-medium text-slate-200">${agent.spec?.safety_gates?.min_net_pnl_usd} USD</span>
          </div>
        </div>

        <div className="pt-2 text-xs font-mono text-slate-400 bg-slate-900/60 p-3 rounded-xl border border-white/5 truncate">
          Agent Address: {agent.spec?.agent_address}
        </div>
      </div>

      {/* Stress Suite Results Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
            Synthetic Failure Injection Suite
            {agent.score && (
              <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-white/5 text-slate-300 border border-white/10">
                Score: {agent.score}
              </span>
            )}
          </h2>
          {agent.stress_status === 'RUNNING' && (
            <span className="text-xs text-amber-400 animate-pulse font-medium">
              Running simulation forks...
            </span>
          )}
        </div>

        {results.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.01] border border-dashed border-white/10 text-slate-400 text-sm space-y-3">
            <p>No stress tests executed yet.</p>
            <button
              onClick={handleLaunchStressTest}
              className="px-4 py-2 rounded-xl bg-red-600 text-white text-xs font-medium hover:bg-red-500"
            >
              Run 6-Test Suite Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {results.map((res, idx) => (
              <div
                key={idx}
                className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  res.passed
                    ? 'bg-emerald-500/[0.02] border-emerald-500/20'
                    : 'bg-rose-500/[0.02] border-rose-500/20'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Test 0{idx + 1}
                    </span>
                    <h3 className="font-semibold text-white text-sm capitalize">
                      {res.test_name.replace('_', ' ')}
                    </h3>
                  </div>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      res.passed
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}
                  >
                    {res.passed ? 'PASSED' : 'FAILED'}
                  </span>
                </div>

                <p className="text-xs text-slate-400 border-t border-white/5 pt-2">
                  <strong className="text-slate-300 font-medium">Injected Failure:</strong> {res.failure_injected}
                </p>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-slate-500 block">Agent Verdict</span>
                    <span className={`font-semibold ${res.verdict === 'APPROVED' ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {res.verdict}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Duration</span>
                    <span className="text-slate-300">{res.duration_ms} ms</span>
                  </div>
                </div>

                {res.revert_reason && (
                  <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] font-mono">
                    Revert Reason: {res.revert_reason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
