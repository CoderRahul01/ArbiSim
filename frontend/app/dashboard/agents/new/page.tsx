'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

export default function NewAgentPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('Avalanche Yield & Arbitrage Agent');
  const [description, setDescription] = useState('Executes automated swaps on TraderJoe V1 and Pangolin DEXs on Avalanche C-Chain.');
  const [network, setNetwork] = useState<'avalanche-mainnet' | 'avalanche-fuji'>('avalanche-mainnet');
  const [agentAddress, setAgentAddress] = useState('0x742d35Cc6634C0532925a3b844Bc454e4438f44e');

  // Transactions list (Default preset: Wrap 0.1 AVAX to WAVAX on Avalanche C-Chain)
  const [transactions, setTransactions] = useState([
    {
      to: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // WAVAX Mainnet
      data: '0xd0e30db0', // deposit()
      value: '100000000000000000', // 0.1 AVAX
    },
  ]);

  // Safety Gates
  const [maxSlippagePct, setMaxSlippagePct] = useState(2.0);
  const [maxGasCostAvax, setMaxGasCostAvax] = useState(0.05);
  const [minNetPnlUsd, setMinNetPnlUsd] = useState(-5.0);
  const [rejectOnMevRisk, setRejectOnMevRisk] = useState(true);

  const addTx = () => {
    setTransactions([
      ...transactions,
      { to: '0x', data: '0x', value: '0' },
    ]);
  };

  const updateTx = (index: number, field: string, val: string) => {
    const updated = [...transactions];
    updated[index] = { ...updated[index], [field]: val };
    setTransactions(updated);
  };

  const removeTx = (index: number) => {
    setTransactions(transactions.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const raw = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
      const key = raw.trim().replace(/[^\x20-\x7E]/g, '') || 'demo';

      const spec = {
        network,
        agent_address: agentAddress,
        transactions,
        safety_gates: {
          max_slippage_pct: maxSlippagePct,
          max_gas_cost_avax: maxGasCostAvax,
          min_net_pnl_usd: minNetPnlUsd,
          reject_on_mev_risk: rejectOnMevRisk,
          reject_on_oracle_crash: true,
        },
        allowed_routers: ['0x60aE616a2155Ee3d9A68541Ba4544862310933d4'],
      };

      const res = await fetch(`${CF_WORKER_URL}/api/v1/agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': key,
        },
        body: JSON.stringify({
          name,
          description,
          spec,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create agent');
      }

      router.push(`/dashboard/agents/${data.agent_id}`);
    } catch (err: any) {
      setError(err.message || 'An error occurred while creating the agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <Link href="/dashboard/agents" className="text-xs text-slate-400 hover:text-white transition-colors">
          ← Back to Agent Studio
        </Link>
        <h1 className="text-2xl font-bold text-white tracking-tight">Create Agent Specification</h1>
        <p className="text-slate-400 text-sm">
          Define your AI agent's strategy, expected transactions, and safety gates for stress testing.
        </p>
      </div>

      {/* Step Progress Bar */}
      <div className="grid grid-cols-4 gap-2 pt-2">
        {[
          { num: 1, label: 'Basic Info' },
          { num: 2, label: 'Transactions' },
          { num: 3, label: 'Safety Gates' },
          { num: 4, label: 'Review & Submit' },
        ].map((s) => (
          <div
            key={s.num}
            onClick={() => s.num < step && setStep(s.num)}
            className={`p-3 rounded-xl border transition-all ${
              step === s.num
                ? 'bg-red-500/10 border-red-500/30 text-white'
                : step > s.num
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 cursor-pointer'
                : 'bg-white/[0.01] border-white/5 text-slate-500'
            }`}
          >
            <div className="text-xs font-semibold">Step 0{s.num}</div>
            <div className="text-xs truncate">{s.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Step 1: Basic Info */}
      {step === 1 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
          <h2 className="text-lg font-semibold text-white">Step 1: Agent Identification & Chain</h2>

          <div className="space-y-4 text-sm">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Agent Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Avalanche Yield Agent v1"
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Description (Optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Describe what strategy this agent executes..."
                className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-red-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Target Chain</label>
                <select
                  value={network}
                  onChange={(e) => setNetwork(e.target.value as any)}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white focus:outline-none focus:border-red-500"
                >
                  <option value="avalanche-mainnet">Avalanche C-Chain Mainnet (43114)</option>
                  <option value="avalanche-fuji">Avalanche Fuji Testnet (43113)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Agent Wallet Address</label>
                <input
                  type="text"
                  value={agentAddress}
                  onChange={(e) => setAgentAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-xs focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all"
            >
              Next: Transactions →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Transactions */}
      {step === 2 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Step 2: Transaction Payload</h2>
            <button
              onClick={addTx}
              className="text-xs text-red-400 hover:text-red-300 font-medium"
            >
              + Add Transaction
            </button>
          </div>

          <div className="space-y-4">
            {transactions.map((tx, i) => (
              <div key={i} className="p-4 rounded-xl bg-slate-900/60 border border-white/5 space-y-3 relative">
                <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                  <span>Transaction #{i + 1}</span>
                  {transactions.length > 1 && (
                    <button onClick={() => removeTx(i)} className="text-rose-400 hover:text-rose-300">
                      Remove
                    </button>
                  )}
                </div>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-slate-400 mb-1">To Contract Address</label>
                    <input
                      type="text"
                      value={tx.to}
                      onChange={(e) => updateTx(i, 'to', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Calldata (Hex)</label>
                    <textarea
                      value={tx.data}
                      onChange={(e) => updateTx(i, 'data', e.target.value)}
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 font-mono text-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Value (Wei)</label>
                    <input
                      type="text"
                      value={tx.value}
                      onChange={(e) => updateTx(i, 'value', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-white/10 font-mono text-slate-300"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm hover:bg-white/10"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(3)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all"
            >
              Next: Safety Gates →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Safety Gates */}
      {step === 3 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
          <h2 className="text-lg font-semibold text-white">Step 3: Safety Gate Parameters</h2>

          <div className="space-y-5 text-sm">
            <div>
              <div className="flex justify-between text-slate-300 font-medium mb-1">
                <label>Max Allowed Slippage</label>
                <span className="text-red-400 font-mono">{maxSlippagePct}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="10.0"
                step="0.1"
                value={maxSlippagePct}
                onChange={(e) => setMaxSlippagePct(parseFloat(e.target.value))}
                className="w-full accent-red-500 cursor-pointer"
              />
              <p className="text-xs text-slate-500 mt-1">Transactions exceeding this slippage percentage will be REJECTED.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Max Gas Cap (AVAX)</label>
                <input
                  type="number"
                  step="0.001"
                  value={maxGasCostAvax}
                  onChange={(e) => setMaxGasCostAvax(parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Min Net P&L Floor (USD)</label>
                <input
                  type="number"
                  step="0.5"
                  value={minNetPnlUsd}
                  onChange={(e) => setMinNetPnlUsd(parseFloat(e.target.value))}
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-900 border border-white/10 text-white font-mono text-sm"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-center gap-3 p-3 rounded-xl bg-slate-900/50 border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rejectOnMevRisk}
                  onChange={(e) => setRejectOnMevRisk(e.target.checked)}
                  className="w-4 h-4 accent-red-500 rounded"
                />
                <div>
                  <span className="block font-medium text-white text-xs">Reject on MEV Sandwich Risk</span>
                  <span className="block text-slate-500 text-xs">Automatically reject transactions if an adversarial MEV frontrun is detected.</span>
                </div>
              </label>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm hover:bg-white/10"
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(4)}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all"
            >
              Next: Review Spec →
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/5 space-y-6">
          <h2 className="text-lg font-semibold text-white">Step 4: Review Agent Specification</h2>

          <div className="space-y-4 p-4 rounded-xl bg-slate-900/60 border border-white/5 text-xs text-slate-300 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 block">Agent Name</span>
                <span className="font-semibold text-white">{name}</span>
              </div>
              <div>
                <span className="text-slate-500 block">Target Chain</span>
                <span className="font-semibold text-red-400">{network}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-500 block">Agent Wallet Address</span>
              <span className="font-mono text-slate-200">{agentAddress}</span>
            </div>

            <div className="pt-2 border-t border-white/5">
              <span className="text-slate-500 block mb-1">Safety Gates</span>
              <ul className="list-disc list-inside space-y-1 text-slate-300 font-mono">
                <li>Max Slippage: {maxSlippagePct}%</li>
                <li>Max Gas Cap: {maxGasCostAvax} AVAX</li>
                <li>Min Net P&L Floor: ${minNetPnlUsd} USD</li>
                <li>Reject MEV Sandwich: {rejectOnMevRisk ? 'Yes' : 'No'}</li>
              </ul>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(3)}
              className="px-4 py-2 rounded-xl bg-white/5 text-slate-300 text-sm hover:bg-white/10"
            >
              ← Back
            </button>

            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-medium text-sm transition-all shadow-lg shadow-red-950/40 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating Agent...
                </>
              ) : (
                'Save Agent Spec & Run Stress Tests →'
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
