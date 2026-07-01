'use client';

import { useState } from 'react';

const ROADMAP_STEPS = [
  {
    phase: 'Phase 1',
    title: 'MPC Secure Co-signing',
    status: 'In Progress',
    description: 'Transform simulation results into automated policy enforcement. The Express gateway acts as a co-signer, blocking transactions that fail pre-flight checks (high slippage, malicious calls, low reputation payees).',
    badgeColor: 'text-amber bg-amber/10 border-amber/20'
  },
  {
    phase: 'Phase 2',
    title: 'Avalanche AWM / Teleporter Simulator',
    status: 'Planned',
    description: 'Dual-fork Anvil simulation for testing cross-subnet agent commerce. Mock cross-chain warp messages and Teleporter delivery in a sandbox environment before deploying to production.',
    badgeColor: 'text-teal bg-teal/10 border-teal/20'
  },
  {
    phase: 'Phase 3',
    title: 'Agentic L1 Subnet Launch',
    status: 'Planned',
    description: 'A sovereign Avalanche L1 for agent deployment. Validator-level reputation (ERC-8004) enforcement and optimized gas models to make agent swarms coordinate cheaply.',
    badgeColor: 'text-text-tertiary bg-elevated border-border'
  }
];

const GRANT_MILESTONES = [
  {
    title: 'Retro9000 Application',
    target: 'Q3 2026',
    status: 'Preparing Proposal',
    detail: 'Targeting the Avalanche Foundation’s $40M grant pool to fund the AWM Cross-Subnet Simulation tooling.'
  },
  {
    title: 'Arbitrum Stylus Grant',
    target: 'Completed',
    status: 'Approved',
    detail: 'Successfully built EVM-to-WASM transition ink metrics and Stylus precompile detection.'
  }
];

export default function RoadmapPage() {
  const [activeTab, setActiveTab] = useState<'roadmap' | 'coprocessor' | 'tokenomics'>('roadmap');

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-text-primary">Roadmap & Grants</h1>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal animate-pulse-dot" />
            <span className="text-xs text-text-tertiary">Platform Pivot Active</span>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-5xl w-full mx-auto space-y-8">
        {/* Pitch Card */}
        <div className="p-6 rounded-xl border border-coral/20 bg-coral/5 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-coral/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="relative z-10 space-y-3">
            <span className="text-[10px] font-mono uppercase tracking-widest text-coral border border-coral/30 px-2 py-0.5 rounded">
              The Evolution
            </span>
            <h2 className="text-xl font-bold text-text-primary">From Pre-flight Check to Agent Co-processor</h2>
            <p className="text-xs text-text-secondary leading-relaxed max-w-2xl">
              Pre-flight simulation is just the beginning. ArbiSim is evolving into the active execution layer for Web3 AI Agents.
              By moving up the stack into **MPC co-signing** and **multi-subnet orchestration**, we protect capital and drive economic volume across Avalanche9000 L1s and Arbitrum.
            </p>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveTab('roadmap')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'roadmap' ? 'border-coral text-coral' : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Roadmap & Retro9000
          </button>
          <button
            onClick={() => setActiveTab('coprocessor')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'coprocessor' ? 'border-coral text-coral' : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            MPC Co-signing Policy
          </button>
          <button
            onClick={() => setActiveTab('tokenomics')}
            className={`px-4 py-2 text-xs font-semibold border-b-2 transition-colors ${
              activeTab === 'tokenomics' ? 'border-coral text-coral' : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            Tokenomics & Gas Sinks
          </button>
        </div>

        {/* Tab content */}
        {activeTab === 'roadmap' && (
          <div className="grid md:grid-cols-3 gap-6 animate-fade-in">
            {/* Left 2 cols: Roadmap */}
            <div className="md:col-span-2 space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-text-tertiary">Development Horizons</h3>
              <div className="space-y-4">
                {ROADMAP_STEPS.map((step, idx) => (
                  <div key={idx} className="p-5 rounded-xl border border-border bg-surface flex gap-4">
                    <div className="w-8 h-8 rounded-lg bg-elevated border border-border flex items-center justify-center shrink-0 font-mono text-xs font-bold text-coral">
                      {idx + 1}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <h4 className="text-sm font-semibold text-text-primary">{step.title}</h4>
                        <span className={`text-[9px] font-mono border px-2 py-0.5 rounded-full ${step.badgeColor}`}>
                          {step.status}
                        </span>
                      </div>
                      <p className="text-xs text-text-secondary leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right col: Grant milestones */}
            <div className="space-y-4">
              <h3 className="text-xs font-mono uppercase tracking-wider text-text-tertiary">Grant Milestones</h3>
              <div className="space-y-4">
                {GRANT_MILESTONES.map((m, idx) => (
                  <div key={idx} className="p-5 rounded-xl border border-border bg-surface space-y-2">
                    <div className="flex justify-between items-center">
                      <h4 className="text-xs font-semibold text-text-primary">{m.title}</h4>
                      <span className="text-[9px] font-mono text-coral bg-coral/10 border border-coral/20 px-2 py-0.5 rounded">
                        {m.target}
                      </span>
                    </div>
                    <p className="text-[10px] text-text-tertiary uppercase font-mono tracking-wider">{m.status}</p>
                    <p className="text-xs text-text-secondary leading-relaxed">{m.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'coprocessor' && (
          <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
            {/* Visual Flowchart */}
            <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
              <h3 className="text-sm font-semibold text-text-primary">Co-processor Security Flow</h3>
              <div className="flex flex-col gap-3">
                <div className="p-3 bg-elevated border border-border rounded-lg flex items-center justify-between text-xs">
                  <span className="font-mono text-text-secondary">1. Agent initiates trade</span>
                  <span className="text-[10px] text-teal">RPC trigger</span>
                </div>
                <div className="flex justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary">
                    <path d="M12 5v14M19 12l-7 7-7-7"/>
                  </svg>
                </div>
                <div className="p-3 bg-elevated border border-border rounded-lg flex items-center justify-between text-xs">
                  <span className="font-mono text-text-secondary">2. Fork Simulation & Validation</span>
                  <span className="text-[10px] text-coral">ArbiSim Engine</span>
                </div>
                <div className="flex justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary">
                    <path d="M12 5v14M19 12l-7 7-7-7"/>
                  </svg>
                </div>
                <div className="p-3 bg-elevated border border-coral/30 rounded-lg flex items-center justify-between text-xs">
                  <span className="font-mono text-text-secondary">3. Policy Check (Slippage/Reputation)</span>
                  <span className="text-[10px] text-coral font-bold">Policy Gate</span>
                </div>
                <div className="flex justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-tertiary">
                    <path d="M12 5v14M19 12l-7 7-7-7"/>
                  </svg>
                </div>
                <div className="p-3 bg-teal/10 border border-teal/30 rounded-lg flex items-center justify-between text-xs text-teal">
                  <span className="font-mono font-semibold">4. MPC Co-sign & Settlement</span>
                  <span className="text-[10px] font-mono">On-chain Broadcast</span>
                </div>
              </div>
            </div>

            {/* Developer Playground Code block */}
            <div className="p-6 rounded-xl border border-border bg-surface flex flex-col justify-between space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-1">Developer Playground</h3>
                <p className="text-xs text-text-secondary mb-4">Define execution security rules directly in your agent config:</p>
                <pre className="p-4 bg-zinc-950 border border-border rounded-lg text-xs text-coral font-mono overflow-x-auto">
{`{
  "cosigner": "arbisim-gate.eth",
  "policies": {
    "max_slippage_tolerance": "0.5%",
    "mev_protection": true,
    "block_reverting_txs": true,
    "reputation": {
      "registry": "ERC-8004",
      "min_score": 50
    }
  }
}`}
                </pre>
              </div>
              <p className="text-[11px] text-text-tertiary leading-relaxed">
                If the pre-flight simulation fails any of the policies above, ArbiSim refuses to sign the transaction, securing your capital against exploits.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'tokenomics' && (
          <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
            {/* Native Gas Sink */}
            <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
              <div className="w-10 h-10 rounded-lg bg-teal/10 border border-teal/20 flex items-center justify-center text-teal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Native Gas Sinks</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                Chains integrate ArbiSim because we drive utility to their native assets. Each simulation/co-signature micro-fee can be paid in the host chain’s gas token (e.g. AVAX, or custom L1 tokens on Avalanche9000). This creates constant transaction volume and direct utility.
              </p>
            </div>

            {/* Profit Sharing */}
            <div className="p-6 rounded-xl border border-border bg-surface space-y-4">
              <div className="w-10 h-10 rounded-lg bg-coral/10 border border-coral/20 flex items-center justify-center text-coral">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <h3 className="text-sm font-semibold text-text-primary">Profit Sharing & Alignment</h3>
              <p className="text-xs text-text-secondary leading-relaxed">
                When our Intent Solver dynamically routes transactions and saves agents from slippage/front-running, ArbiSim captures a percentage of the saved value, sharing a portion back with the host chain validators. This aligns validator performance directly with agentic commerce.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
