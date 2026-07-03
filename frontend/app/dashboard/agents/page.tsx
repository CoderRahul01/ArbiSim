'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

interface Agent {
  id: string;
  name: string;
  description?: string;
  network: string;
  stress_status: 'NOT_STARTED' | 'PENDING' | 'RUNNING' | 'PASSED' | 'FAILED' | 'ERROR' | 'DEPLOYED';
  latest_stress_id?: string;
  score?: string;
  deployment_tx?: string;
  deployed_at?: string;
  created_at: string;
}

export default function AgentsListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    setLoading(true);
    setError(null);
    try {
      const raw = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
      const key = raw.trim().replace(/[^\x20-\x7E]/g, '') || 'demo';

      const res = await fetch(`${CF_WORKER_URL}/api/v1/agents`, {
        headers: { 'X-API-Key': key },
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch agents (${res.status})`);
      }

      const data = await res.json();
      setAgents(data.agents || []);
    } catch (err: any) {
      setError(err.message || 'Error loading agents');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'DEPLOYED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">LIVE ON MAINNET</span>;
      case 'PASSED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">PASSED (6/6)</span>;
      case 'RUNNING':
      case 'PENDING':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse">STRESS TESTING...</span>;
      case 'FAILED':
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20">FAILED GATES</span>;
      default:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">DRAFT</span>;
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-3">
            Agent Studio
            <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              Avalanche C-Chain
            </span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Build, stress-test against live chain failure scenarios, and deploy verified AI agents to Avalanche.
          </p>
        </div>

        <Link
          href="/dashboard/agents/new"
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all shadow-lg shadow-red-950/40 border border-red-400/20 gap-2 shrink-0"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Create New Agent
        </Link>
      </div>

      {/* Overview stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Agents</div>
          <div className="text-2xl font-semibold text-white">{agents.length}</div>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Stress Verified</div>
          <div className="text-2xl font-semibold text-emerald-400">
            {agents.filter(a => a.stress_status === 'PASSED' || a.stress_status === 'DEPLOYED').length}
          </div>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-1">
          <div className="text-xs font-medium text-slate-400 uppercase tracking-wider">Live Mainnet Deployed</div>
          <div className="text-2xl font-semibold text-red-400">
            {agents.filter(a => a.stress_status === 'DEPLOYED').length}
          </div>
        </div>
      </div>

      {/* Main Content */}
      {loading ? (
        <div className="py-16 text-center text-slate-400 space-y-3">
          <div className="inline-block w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm">Loading agent ecosystem...</p>
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl bg-rose-500/5 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      ) : agents.length === 0 ? (
        <div className="py-16 text-center p-8 rounded-2xl bg-white/[0.01] border border-dashed border-white/10 space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
            ⚡
          </div>
          <div className="space-y-1 max-w-md mx-auto">
            <h3 className="text-lg font-semibold text-white">No agents created yet</h3>
            <p className="text-sm text-slate-400">
              Define your AI agent's DeFi strategy and safety parameters to run automated stress testing on Avalanche.
            </p>
          </div>
          <Link
            href="/dashboard/agents/new"
            className="inline-flex items-center px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all"
          >
            Create Your First Agent →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {agents.map((agent) => (
            <div
              key={agent.id}
              className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-all space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/dashboard/agents/${agent.id}`}
                      className="text-lg font-semibold text-white hover:text-red-400 transition-colors"
                    >
                      {agent.name}
                    </Link>
                    {getStatusBadge(agent.stress_status)}
                  </div>
                  {agent.description && (
                    <p className="text-sm text-slate-400">{agent.description}</p>
                  )}
                </div>

                <Link
                  href={`/dashboard/agents/${agent.id}`}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-medium border border-white/10 transition-all text-center shrink-0"
                >
                  View Details & Stress Results →
                </Link>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-white/5 text-xs text-slate-400">
                <div>
                  <span className="block text-slate-500">Target Network</span>
                  <span className="font-medium text-slate-200">{agent.network}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Stress Test Score</span>
                  <span className="font-medium text-slate-200">{agent.score || 'Not tested'}</span>
                </div>
                <div>
                  <span className="block text-slate-500">Created At</span>
                  <span className="font-medium text-slate-200">
                    {new Date(agent.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-500">Mainnet Status</span>
                  <span className="font-medium text-slate-200">
                    {agent.deployment_tx ? 'Verified & Live' : 'Not Deployed'}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
