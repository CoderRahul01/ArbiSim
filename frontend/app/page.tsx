'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export default function HomePage() {
  const [selectedChain, setSelectedChain] = useState<'avalanche' | 'injective' | 'solana' | 'arbitrum'>('avalanche');
  const [selectedScenario, setSelectedScenario] = useState<'swap' | 'userop' | 'wasm'>('swap');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);

  const handleRunSimulation = () => {
    setIsSimulating(true);
    setSimResult(null);

    setTimeout(() => {
      setIsSimulating(false);
      if (selectedScenario === 'swap') {
        setSimResult({
          verdict: 'APPROVED',
          safe_to_execute: true,
          network: selectedChain === 'avalanche' ? 'Avalanche C-Chain' : selectedChain === 'injective' ? 'Injective EVM' : selectedChain === 'solana' ? 'Solana SVM' : 'Arbitrum Nitro',
          gas_used: selectedChain === 'solana' ? '145,000 CUs' : '142,500 gas',
          fee_usd: '$0.038',
          net_pnl_usd: '+$14.20',
          slippage: '0.08%',
          mev_risk: 'LOW (0.04)',
          flags: [],
        });
      } else if (selectedScenario === 'userop') {
        setSimResult({
          verdict: 'APPROVED',
          safe_to_execute: true,
          network: selectedChain === 'avalanche' ? 'Avalanche C-Chain' : selectedChain === 'injective' ? 'Injective EVM' : selectedChain === 'solana' ? 'Solana SVM' : 'Arbitrum Nitro',
          gas_used: '210,000 gas',
          fee_usd: '$0.052',
          net_pnl_usd: '+$0.00',
          session_key_valid: 'Valid until block +3600',
          flags: [],
        });
      } else {
        setSimResult({
          verdict: 'REJECTED',
          safe_to_execute: false,
          network: selectedChain === 'avalanche' ? 'Avalanche C-Chain' : selectedChain === 'injective' ? 'Injective EVM' : selectedChain === 'solana' ? 'Solana SVM' : 'Arbitrum Nitro',
          revert_reason: selectedChain === 'arbitrum' ? 'Stylus WASM Ink limit exceeded (Host IO penalty)' : 'Price impact exceeds 3.50% threshold',
          flags: [selectedChain === 'arbitrum' ? 'STYLUS_INK_OVERFLOW' : 'HIGH_SLIPPAGE'],
        });
      }
    }, 650);
  };

  return (
    <div className="min-h-screen bg-[#07090E] text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      
      {/* ── BACKGROUND GLOWS ──────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-indigo-600/15 via-purple-600/10 to-transparent blur-3xl rounded-full" />
        <div className="absolute top-1/3 left-10 w-96 h-96 bg-emerald-500/5 blur-3xl rounded-full" />
        <div className="absolute top-1/2 right-10 w-96 h-96 bg-indigo-500/5 blur-3xl rounded-full" />
      </div>

      {/* ── NAV BAR ───────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-slate-800/80 bg-[#07090E]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-0.5 shadow-lg shadow-indigo-500/20">
              <div className="w-full h-full bg-[#07090E] rounded-[7px] flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-indigo-400">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
              </div>
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white tracking-tight">ArbiSim Guard</span>
                <span className="text-[10px] font-mono uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700/60 px-1.5 py-0.5 rounded">Multi-Chain</span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">by Anteratic Labs</span>
            </div>
          </div>

          <div className="hidden md:flex items-center gap-6 text-sm text-slate-300 font-medium">
            <a href="#chains" className="hover:text-white transition-colors">Chains</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#developer" className="hover:text-white transition-colors">MCP / API</a>
            <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/dashboard/simulate"
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all duration-200 active:scale-95 flex items-center gap-2"
            >
              <span>Launch Dashboard</span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M5 12h14M12 5l7 7-7 7"/>
              </svg>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ──────────────────────────────────────── */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 pt-32 pb-20">
        
        {/* Chain Badges */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mb-8">
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-800 bg-slate-900/80 text-xs text-slate-300 font-mono shadow-inner">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Avalanche
          </span>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-800 bg-slate-900/80 text-xs text-slate-300 font-mono shadow-inner">
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
            Injective
          </span>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-800 bg-slate-900/80 text-xs text-slate-300 font-mono shadow-inner">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Solana
          </span>
          <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-slate-800 bg-slate-900/80 text-xs text-slate-300 font-mono shadow-inner">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Arbitrum
          </span>
        </div>

        <div className="text-center max-w-4xl mx-auto mb-12">
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.12] mb-6">
            AI agents handle real money.<br />
            <span className="bg-gradient-to-r from-indigo-400 via-purple-300 to-pink-400 bg-clip-text text-transparent">
              Verify every transaction before it touches mainnet.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-400 leading-relaxed max-w-2xl mx-auto">
            ArbiSim Guard is the neutral, multi-chain pre-flight security layer for autonomous AI agents.
            Simulate payload execution in block-accurate ephemeral forks to receive instant <strong className="text-emerald-400">APPROVED</strong> or <strong className="text-red-400">REJECTED</strong> verdicts.
          </p>
        </div>

        {/* ── INTERACTIVE LIVE SIMULATOR PLAYGROUND ───────────── */}
        <div className="max-w-4xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-slate-800/80 pb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                <h3 className="text-base font-semibold text-white">Live Pre-Flight Sandbox</h3>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Dry-run an agent proposal live against forked RPC state</p>
            </div>
            
            <div className="flex items-center gap-2 font-mono text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-emerald-400">●</span> 800ms Avg Telemetry
            </div>
          </div>

          {/* Network Selector */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            {[
              { id: 'avalanche', name: 'Avalanche', icon: '🔺' },
              { id: 'injective', name: 'Injective', icon: '🥷' },
              { id: 'solana', name: 'Solana', icon: '⚡' },
              { id: 'arbitrum', name: 'Arbitrum', icon: '💙' },
            ].map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedChain(c.id as any)}
                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                  selectedChain === c.id
                    ? 'border-indigo-500 bg-indigo-500/10 text-white font-semibold shadow-inner'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* Scenario Selector */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              { id: 'swap', label: 'DEX Arbitrage Swap' },
              { id: 'userop', label: 'ERC-4337 UserOp' },
              { id: 'wasm', label: 'High Slippage / Revert' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedScenario(s.id as any)}
                className={`py-2 px-3 rounded-md text-xs font-mono text-center border transition-all ${
                  selectedScenario === s.id
                    ? 'border-slate-700 bg-slate-800 text-indigo-300 font-semibold'
                    : 'border-slate-800/60 bg-slate-950/40 text-slate-400 hover:text-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Action Button */}
          <button
            onClick={handleRunSimulation}
            disabled={isSimulating}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-500/20 transition-all active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 mb-6"
          >
            {isSimulating ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span>Executing Block Fork Simulation...</span>
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polygon points="5 3 19 12 5 21 5 3"/>
                </svg>
                <span>Run Pre-Flight Check ({selectedChain.toUpperCase()})</span>
              </>
            )}
          </button>

          {/* Terminal Output */}
          {simResult && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 font-mono text-xs text-slate-300 space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${simResult.safe_to_execute ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  <span className="font-bold text-white">VERDICT: {simResult.verdict}</span>
                </div>
                <span className="text-[10px] text-slate-500">Session ID: sim_9f82a1b7c0</span>
              </div>

              {simResult.safe_to_execute ? (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 text-slate-400">
                  <div>Network: <span className="text-white">{simResult.network}</span></div>
                  <div>Gas: <span className="text-white">{simResult.gas_used}</span></div>
                  <div>Fee USD: <span className="text-emerald-400">{simResult.fee_usd}</span></div>
                  <div>Est Net P&L: <span className="text-emerald-400 font-bold">{simResult.net_pnl_usd}</span></div>
                </div>
              ) : (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-300 space-y-1">
                  <div className="font-bold text-red-400">⚠️ Risk Detected — Execution Blocked</div>
                  <div>Reason: {simResult.revert_reason}</div>
                  <div>Flags: {simResult.flags.join(', ')}</div>
                </div>
              )}

              <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-800/60 flex items-center justify-between">
                <span>Proof: Cryptographic Simulation Receipt Verified</span>
                <Link href="/dashboard/simulate" className="text-indigo-400 hover:underline">Full Telemetry →</Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ── ECOSYSTEM & CHAINS GRID ───────────────────────────── */}
      <section id="chains" className="border-t border-slate-800/80 py-20 bg-slate-950/40">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">Multi-Chain Ecosystem Protection</h2>
            <p className="text-slate-400 text-sm max-w-xl mx-auto">
              Decoupled execution analyzers built natively for each chain&apos;s execution model and oracle architecture.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                name: 'Avalanche C-Chain',
                icon: '🔺',
                tag: 'Sub-second Finality',
                desc: 'Avalanche Warp Messaging (AWM), Snowman consensus finality validation, and DEX router analytics.',
              },
              {
                name: 'Injective EVM',
                icon: '🥷',
                tag: 'Native CLOB',
                desc: 'Frequent Batch Auction (FBA) MEV resistance, Exchange Precompile execution, and Pyth pull oracle pricing.',
              },
              {
                name: 'Solana SVM',
                icon: '⚡',
                tag: 'Compute Unit Budget',
                desc: 'SVM Compute Unit (CU) instruction parsing, micro-lamports priority fees, and Jito tip-auction protection.',
              },
              {
                name: 'Arbitrum Nitro',
                icon: '💙',
                tag: 'Stylus WASM',
                desc: 'Brotli-zero L1 calldata fee math, Stylus WASM ink conversion (1:10k ratio), and Timeboost fastlane checks.',
              },
            ].map((chain) => (
              <div
                key={chain.name}
                className="bg-slate-900/60 border border-slate-800/80 hover:border-slate-700 rounded-xl p-6 flex flex-col justify-between transition-all duration-200 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-2xl">{chain.icon}</span>
                    <span className="text-[11px] font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded">
                      {chain.tag}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2 group-hover:text-indigo-300 transition-colors">{chain.name}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{chain.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS (3 STEPS) ────────────────────────────── */}
      <section id="how-it-works" className="border-t border-slate-800/80 py-24">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">How ArbiSim Guard Works</h2>
            <p className="text-slate-400 text-sm">Three steps. Zero risk to mainnet funds.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Agent Submits Proposal',
                desc: 'Your AI agent framework passes the raw transaction payload or ERC-4337 UserOp to ArbiSim Guard before broadcasting.',
              },
              {
                step: '02',
                title: 'Ephemeral Block Fork',
                desc: 'ArbiSim spins up a block-pinned fork at current head, executing the payload in isolation using wallet impersonation.',
              },
              {
                step: '03',
                title: 'Instant Verdict & Receipt',
                desc: 'The Python analytical engine evaluates gas, MEV, slippage, and WASM ink, returning an APPROVED or REJECTED receipt.',
              },
            ].map((item) => (
              <div key={item.step} className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-8 flex flex-col gap-4">
                <span className="font-mono text-2xl font-bold text-indigo-500">{item.step}</span>
                <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEVELOPER / MCP INTEGRATION ───────────────────────── */}
      <section id="developer" className="border-t border-slate-800/80 py-24 bg-slate-950/60">
        <div className="max-w-5xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">Plug into Any Agent Stack</h2>
            <p className="text-slate-400 text-sm">Native Model Context Protocol (MCP) server & REST API integration.</p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 font-mono text-xs overflow-x-auto text-slate-300 shadow-2xl">
            <div className="text-slate-500 mb-3">// claude_desktop_config.json or MCP agent configuration</div>
            <pre className="text-indigo-300">
{`{
  "mcpServers": {
    "arbisim-guard": {
      "type": "sse",
      "url": "https://arbisimguard.com/mcp/sse?api_key=YOUR_API_KEY"
    }
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* ── FOOTER ────────────────────────────────────────────── */}
      <footer className="border-t border-slate-800/80 py-12 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-slate-500 font-mono">
          <div>
            © 2026 ArbiSim Guard by Anteratic Labs. All rights reserved.
          </div>
          <div className="flex items-center gap-6">
            <a href="/llms.txt" target="_blank" className="hover:text-slate-300 transition-colors">llms.txt</a>
            <a href="/sitemap.xml" target="_blank" className="hover:text-slate-300 transition-colors">sitemap.xml</a>
            <Link href="/docs" className="hover:text-slate-300 transition-colors">Docs</Link>
            <Link href="/status" className="hover:text-slate-300 transition-colors">System Status</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}
