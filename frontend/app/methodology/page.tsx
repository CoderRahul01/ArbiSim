'use client';

import React from 'react';
import Link from 'next/link';

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E2E8F0] font-sans antialiased selection:bg-[#20242D] selection:text-white">
      {/* Navigation Header */}
      <div className="border-b border-[#1E232E] bg-[#0E1015]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Link href="/" className="font-serif text-xl tracking-tight text-white flex items-center space-x-2">
              <span className="text-[#3B82F6] font-sans font-bold">▲</span>
              <span>ArbiSim Guard</span>
            </Link>
            <span className="text-xs px-2 py-0.5 rounded bg-[#1B2130] border border-[#2B354F] text-[#4F86F7] font-mono uppercase tracking-wide">
              Trust Portal
            </span>
          </div>
          <div className="flex items-center space-x-6 text-sm">
            <Link href="/trust" className="text-[#94A3B8] hover:text-white transition-colors">
              Attestations
            </Link>
            <Link href="/dashboard" className="text-[#94A3B8] hover:text-white transition-colors">
              Console
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        
        {/* Title */}
        <div className="space-y-4">
          <h1 className="text-3xl font-serif text-white tracking-tight">Simulation Methodology & Rubric</h1>
          <p className="text-[#94A3B8] text-sm">
            ArbiSim Guard evaluates transaction payloads and ERC-4337 UserOperations inside block-accurate, ephemeral EVM forks. Every safety verdict is backed by an on-chain ledger attestation. Learn about the 12 flags we track and how you can verify them.
          </p>
        </div>

        {/* The Attestation Mechanism */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif text-white tracking-tight">On-Chain Attestation Mechanism</h2>
          <div className="bg-[#0E1015] border border-[#1E232E] rounded-md p-6 space-y-3 text-sm">
            <p className="text-[#94A3B8]">
              Unlike traditional API checkers that return private JSON payloads, ArbiSim Guard writes the outcome of every pre-flight simulation to the public blockchain via the <code className="font-mono text-white bg-[#1A1E26] px-1 py-0.5 rounded">SimulationRegistry.sol</code> smart contract.
            </p>
            <p className="text-[#94A3B8]">
              Each logged registry record contains:
            </p>
            <ul className="list-disc pl-5 space-y-1 font-mono text-xs text-[#94A3B8]">
              <li><strong className="text-white">sessionId</strong>: Unique 32-byte identifier for the simulation.</li>
              <li><strong className="text-white">agent</strong>: The wallet or smart account executing the transactions.</li>
              <li><strong className="text-white">safeToExecute</strong>: Boolean safety verdict (APPROVED or REJECTED).</li>
              <li><strong className="text-white">flagsBitmap</strong>: Bitwise representation of triggered safety flags.</li>
              <li><strong className="text-white">evidenceHash</strong>: Cryptographic Keccak-256 hash of the verification evidence (v3 registry only).</li>
            </ul>
            <p className="text-[#94A3B8] pt-2">
              <span className="text-[#EF4444] font-bold">🔒 Cryptographic Attestation Proof:</span> Verifiers can recalculate the Keccak-256 hash of the evidence items directly in the browser or on their own servers, and compare it to the value committed on-chain. This guarantees that ArbiSim Guard cannot retrospectively modify or hide the evidence behind any safety verdict.
            </p>
          </div>
        </section>

        {/* The 12 Safety Flags */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif text-white tracking-tight">The 12 Attestation Flags</h2>
          <div className="divide-y divide-[#1E232E] border-t border-b border-[#1E232E]">
            
            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_REVERT (1 &lt;&lt; 0)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Execution Revert</h4>
                <p className="text-xs text-[#94A3B8]">
                  The transaction or EntryPoint <code className="font-mono bg-[#16181D] px-1 py-0.2 rounded text-[#EF4444]">handleOps</code> call reverted inside the isolated EVM fork, which would result in burning gas on-chain for no execution.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_HIGH_SLIPPAGE (1 &lt;&lt; 1)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">High Slippage</h4>
                <p className="text-xs text-[#94A3B8]">
                  Slippage calculated from ERC-20 transfer balances exceeds the threshold (e.g. 5.0% or the agent's customized threshold).
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_MEV_RISK (1 &lt;&lt; 2)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">MEV / Frontrun Risk</h4>
                <p className="text-xs text-[#94A3B8]">
                  Adversarial block-ordering risk (frontrun, backrun, or sandwich attack) detected due to DEX trading paths and public mempool depth.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_GAS_HIGH (1 &lt;&lt; 3)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">High Gas Cost</h4>
                <p className="text-xs text-[#94A3B8]">
                  Calculated transaction fee exceeds the gas limit parameter, or the gas cost is dangerously high relative to the transaction size.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_LOW_REPUTATION (1 &lt;&lt; 4)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Low Payee Reputation</h4>
                <p className="text-xs text-[#94A3B8]">
                  The payee address has an active low reputation score in the ERC-8004 reputation registry.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_UNKNOWN_AGENT (1 &lt;&lt; 5)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Unregistered Payee</h4>
                <p className="text-xs text-[#94A3B8]">
                  The payee address has no record in the configured reputation registry.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_PRICE_IMPACT_HIGH (1 &lt;&lt; 6)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">High Price Impact</h4>
                <p className="text-xs text-[#94A3B8]">
                  The transaction calldata indicates a swap that would shift pool reserves significantly, losing capital through bad pricing execution.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_INSUFFICIENT_LIQUIDITY (1 &lt;&lt; 7)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Insufficient Liquidity</h4>
                <p className="text-xs text-[#94A3B8]">
                  Target AMM pool has low liquidity reserves for the desired pair, causing execution blocks to trigger extreme pricing slips.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_BRIDGE_RISK (1 &lt;&lt; 8)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Bridge Risk</h4>
                <p className="text-xs text-[#94A3B8]">
                  Asset transfer attempts to interact with unwhitelisted, paused, or high-risk cross-chain bridge contracts.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#EF4444]">
                FLAG_ORACLE_MANIPULATION (1 &lt;&lt; 9)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Oracle Price Deviation</h4>
                <p className="text-xs text-[#94A3B8]">
                  Fork-simulated DEX pool price deviates significantly from live Chainlink decentralized price feeds, indicating potential sandwich/manipulation events.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#3B82F6]">
                FLAG_VALUE_TRANSFER (1 &lt;&lt; 10)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">High Value Transfer</h4>
                <p className="text-xs text-[#94A3B8]">
                  Transaction executes large transfers of native tokens or major stablecoins, flagged for compliance/audit trails.
                </p>
              </div>
            </div>

            <div className="py-4 flex flex-col md:flex-row md:items-start gap-4">
              <div className="w-48 shrink-0 font-mono text-xs font-bold text-[#3B82F6]">
                FLAG_CONTRACT_CREATION (1 &lt;&lt; 11)
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-white">Contract Deployment</h4>
                <p className="text-xs text-[#94A3B8]">
                  Payload targets the null address or attempts contract creation, monitored for unexpected agent code injection.
                </p>
              </div>
            </div>

          </div>
        </section>

        {/* Private Thresholds */}
        <section className="space-y-4">
          <h2 className="text-lg font-serif text-white tracking-tight">Private Thresholds Statement</h2>
          <div className="p-4 bg-[#111216] border border-[#1E232E] rounded-md text-xs text-[#94A3B8] leading-relaxed">
            <span className="text-white font-bold block mb-1">Why exact thresholds are private:</span>
            To prevent adversarial agents and MEV bots from gaming safety gates (e.g. executing swaps just under the slippage cutoff), exact numerical weighting formulas and thresholds are not published. However, every public verdict detail page contains the specific, plain-language evidence items and metrics that triggered each active flag.
          </div>
        </section>
      </div>
    </div>
  );
}
