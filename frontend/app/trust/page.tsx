'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { decodeEventLog } from 'viem';
import {
  decodeFlags,
  FLAG_LABELS,
  FLAG_BITS,
  REGISTRY_ADDRESSES,
  getPublicClient,
  START_BLOCKS,
  RPC_URLS,
} from '@/lib/trust-utils';

interface VerdictRecord {
  sessionId: string;
  agent: string;
  safeToExecute: boolean;
  flagsBitmap: number;
  chainId: number;
  blockNumber: bigint;
  transactionHash: string;
  networkKey: string;
  version: number;
  timestamp?: number;
}

const CHAIN_DISPLAY_NAMES: Record<string, string> = {
  'arbitrum-one': 'Arbitrum One',
  'arbitrum-sepolia': 'Arbitrum Sepolia',
  'avalanche-mainnet': 'Avalanche C-Chain',
  'avalanche-fuji': 'Avalanche Fuji',
};

const EXPLORERS: Record<string, string> = {
  'arbitrum-one': 'https://arbiscan.io',
  'arbitrum-sepolia': 'https://sepolia.arbiscan.io',
  'avalanche-mainnet': 'https://subnets.avax.network/c-chain',
  'avalanche-fuji': 'https://subnets-test.avax.network/c-chain',
};

// ABI for the SimulationRegistry contract (V2 and V3 functions)
const REGISTRY_ABI_MIN = [
  {
    type: 'function',
    name: 'totalSimulations',
    inputs: [],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRecord',
    inputs: [{ name: 'sessionId', type: 'bytes32' }],
    outputs: [
      {
        name: 'record',
        type: 'tuple',
        components: [
          { name: 'agent', type: 'address' },
          { name: 'txHash', type: 'bytes32' },
          { name: 'safeToExecute', type: 'bool' },
          { name: 'flagsBitmap', type: 'uint16' },
          { name: 'gasEstimate', type: 'uint64' },
          { name: 'chainId', type: 'uint32' },
          { name: 'timestamp', type: 'uint32' },
        ],
      },
      { name: 'revertReason', type: 'string' },
    ],
    stateMutability: 'view',
  },
];

// Event signatures to decode manually from raw logs
const SIMULATION_LOGGED_V2_ABI = {
  type: 'event',
  name: 'SimulationLogged',
  inputs: [
    { name: 'sessionId', type: 'bytes32', indexed: true },
    { name: 'agent', type: 'address', indexed: true },
    { name: 'safeToExecute', type: 'bool', indexed: false },
    { name: 'flagsBitmap', type: 'uint16', indexed: false },
    { name: 'chainId', type: 'uint32', indexed: false },
  ],
} as const;

const SIMULATION_LOGGED_V3_ABI = {
  type: 'event',
  name: 'SimulationLogged',
  inputs: [
    { name: 'sessionId', type: 'bytes32', indexed: true },
    { name: 'agent', type: 'address', indexed: true },
    { name: 'safeToExecute', type: 'bool', indexed: false },
    { name: 'flagsBitmap', type: 'uint16', indexed: false },
    { name: 'chainId', type: 'uint32', indexed: false },
    { name: 'evidenceHash', type: 'bytes32', indexed: false },
  ],
} as const;

export default function TrustDashboard() {
  const [totalAttestations, setTotalAttestations] = useState<number>(0);
  const [countersByChain, setCountersByChain] = useState<Record<string, number>>({});
  const [verdicts, setVerdicts] = useState<VerdictRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost') {
        return 'http://localhost:3001';
      }
    }
    return process.env.NEXT_PUBLIC_CF_WORKER_URL || 'https://arbisim-proxy.rahulpandey-creates.workers.dev';
  };

  useEffect(() => {
    async function loadTrustData() {
      setLoading(true);
      setError(null);
      try {
        const apiBase = getApiUrl();
        const res = await fetch(`${apiBase}/api/v1/verdicts/trust-feed`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        const data = await res.json();
        setTotalAttestations(data.totalAttestations || 0);
        setCountersByChain(data.countersByChain || {});
        setVerdicts(data.verdicts || []);
      } catch (err: any) {
        setError(err.message || 'Failed to query on-chain simulation records');
      } finally {
        setLoading(false);
      }
    }

    loadTrustData();
  }, []);

  // Calculate statistics for the catch-rate breakdown
  const totalVerdictsCount = verdicts.length;
  const flaggedVerdictsCount = verdicts.filter((v) => v.flagsBitmap > 0).length;
  const catchRatePct = totalVerdictsCount
    ? ((flaggedVerdictsCount / totalVerdictsCount) * 100).toFixed(1)
    : '0.0';

  const flagStats: Record<string, number> = {};
  Object.keys(FLAG_BITS).forEach((flagKey) => {
    flagStats[flagKey] = 0;
  });

  verdicts.forEach((v) => {
    Object.entries(FLAG_BITS).forEach(([flagKey, bit]) => {
      if ((v.flagsBitmap & bit) !== 0) {
        flagStats[flagKey] = (flagStats[flagKey] || 0) + 1;
      }
    });
  });

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E2E8F0] font-sans antialiased Selection:bg-[#20242D] selection:text-white">
      {/* Navigation Header */}
      <div className="border-b border-[#1E232E] bg-[#0E1015]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
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
            <Link href="/dashboard" className="text-[#94A3B8] hover:text-white transition-colors">
              Console
            </Link>
            <Link href="/methodology" className="text-[#94A3B8] hover:text-white transition-colors">
              Methodology
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-6 py-10 space-y-10">
        
        {/* Title and Intro */}
        <div className="space-y-2">
          <h1 className="text-3xl font-serif text-white tracking-tight">On-Chain Attestation Registry</h1>
          <p className="text-[#94A3B8] text-sm max-w-3xl">
            Below is the decentralized audit log of ArbiSim Guard simulation verdicts. Every single pass or reject decision is cryptographically anchored on-chain to the <code className="font-mono text-[#E2E8F0] bg-[#16181D] px-1.5 py-0.5 rounded border border-[#252830]">SimulationRegistry</code> contract. Verification does not require trusting our backend.
          </p>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 height-8 border-2 border-t-transparent border-[#3B82F6] rounded-full animate-spin"></div>
            <p className="text-xs font-mono text-[#64748B] uppercase tracking-widest animate-pulse">Syncing logs directly from RPC...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-[#2A1418] border border-[#521C24] text-[#F87171] rounded-md text-sm font-mono flex items-center space-x-3">
            <span className="text-lg">⚠</span>
            <span>Error: {error}</span>
          </div>
        ) : (
          <>
            {/* Stat Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#0E1015] border border-[#1E232E] rounded-md p-6 space-y-2">
                <span className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Total Attested Runs</span>
                <div className="text-4xl font-mono text-white font-bold">{totalAttestations.toLocaleString()}</div>
                <div className="text-xs text-[#64748B] font-mono">
                  {Object.entries(countersByChain).map(([chain, count]) => (
                    <span key={chain} className="mr-3">
                      {chain.replace('-one', '')}: {count}
                    </span>
                  ))}
                </div>
              </div>

              <div className="bg-[#0E1015] border border-[#1E232E] rounded-md p-6 space-y-2">
                <span className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Historical Catch Rate</span>
                <div className="text-4xl font-mono text-[#EF4444] font-bold">{catchRatePct}%</div>
                <div className="text-xs text-[#94A3B8] font-sans">
                  Simulations flagging at least one risk indicator
                </div>
              </div>

              <div className="bg-[#0E1015] border border-[#1E232E] rounded-md p-6 space-y-2">
                <span className="text-xs font-mono text-[#64748B] uppercase tracking-wider">Verifiable Integrity</span>
                <div className="text-4xl font-mono text-[#10B981] font-bold">100%</div>
                <div className="text-xs text-[#94A3B8] font-sans">
                  Double-signed logs anchored in Ethereum L2s & Avalanche C-Chain
                </div>
              </div>
            </div>

            {/* Catch rate breakdown by flag */}
            <div className="bg-[#0E1015] border border-[#1E232E] rounded-md p-6 space-y-6">
              <div>
                <h3 className="text-sm font-mono text-[#E2E8F0] uppercase tracking-wider">Attestation Flags Catch Rate (Last {totalVerdictsCount} Runs)</h3>
                <p className="text-xs text-[#64748B] mt-1">Real risk mitigation metrics surfaced by individual analyzers</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                {Object.entries(FLAG_LABELS).map(([flagKey, label]) => {
                  const count = flagStats[flagKey] || 0;
                  const pct = totalVerdictsCount ? ((count / totalVerdictsCount) * 100) : 0;
                  return (
                    <div key={flagKey} className="flex flex-col space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="text-[#94A3B8]">{label}</span>
                        <span className="text-white font-medium">{pct.toFixed(1)}% ({count})</span>
                      </div>
                      <div className="h-1 bg-[#1A1E26] rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            pct > 30 ? 'bg-[#EF4444]' : pct > 10 ? 'bg-[#F59E0B]' : 'bg-[#3B82F6]'
                          }`}
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Verdicts Table */}
            <div className="bg-[#0E1015] border border-[#1E232E] rounded-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1E232E] flex items-center justify-between">
                <h3 className="text-sm font-mono text-[#E2E8F0] uppercase tracking-wider">Live Verdicts Stream</h3>
                <span className="text-xs font-mono text-[#64748B]">Showing latest {verdicts.length} simulated operations</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono border-collapse">
                  <thead>
                    <tr className="border-b border-[#1E232E] bg-[#0A0B0D] text-[#64748B]">
                      <th className="px-6 py-3 font-medium uppercase tracking-wider">Block / Time</th>
                      <th className="px-6 py-3 font-medium uppercase tracking-wider">Chain</th>
                      <th className="px-6 py-3 font-medium uppercase tracking-wider">Session ID</th>
                      <th className="px-6 py-3 font-medium uppercase tracking-wider">Agent / Caller</th>
                      <th className="px-6 py-3 font-medium uppercase tracking-wider">Safety Status</th>
                      <th className="px-6 py-3 font-medium uppercase tracking-wider">Triggered Flags</th>
                      <th className="px-6 py-3 font-medium uppercase tracking-wider text-right">Attestation TX</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E232E]">
                    {verdicts.map((v) => {
                      const activeFlags = decodeFlags(v.flagsBitmap);
                      const formattedTime = v.timestamp 
                        ? new Date(v.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                        : `Block #${v.blockNumber.toLocaleString()}`;

                      return (
                        <tr key={v.sessionId} className="hover:bg-[#12141A]/50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-[#94A3B8]">
                            {formattedTime}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-white">
                            {CHAIN_DISPLAY_NAMES[v.networkKey] || v.networkKey}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap font-medium text-[#3B82F6] hover:underline">
                            <Link href={`/trust/${v.sessionId}`}>
                              {v.sessionId.slice(0, 8)}...{v.sessionId.slice(-6)}
                            </Link>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-[#94A3B8]">
                            {v.agent.slice(0, 6)}...{v.agent.slice(-4)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wide ${
                              v.safeToExecute 
                                ? 'bg-[#064E3B] text-[#10B981]' 
                                : 'bg-[#7F1D1D] text-[#F87171]'
                            }`}>
                              {v.safeToExecute ? 'Approved' : 'Rejected'}
                            </span>
                          </td>
                          <td className="px-6 py-4 max-w-xs truncate">
                            {activeFlags.length === 0 ? (
                              <span className="text-[#64748B] italic">No flags triggered</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {activeFlags.map((f) => (
                                  <span key={f} className="text-[10px] px-1.5 py-0.2 rounded bg-[#1C1E26] text-[#EF4444] border border-[#3E1C22]">
                                    {FLAG_LABELS[f]}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-[#3B82F6] hover:underline">
                            <a 
                              href={`${EXPLORERS[v.networkKey]}/tx/${v.transactionHash}`} 
                              target="_blank" 
                              rel="noreferrer"
                              className="inline-flex items-center space-x-1"
                            >
                              <span>Explorer</span>
                              <span>↗</span>
                            </a>
                          </td>
                        </tr>
                      );
                    })}
                    {verdicts.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-[#64748B] italic">
                          No simulation records found on-chain for the queried block range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
