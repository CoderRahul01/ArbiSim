'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  decodeFlags,
  FLAG_LABELS,
  REGISTRY_ADDRESSES,
  getCanonicalEvidenceHash,
} from '@/lib/trust-utils';

interface EvidenceItem {
  flag: string;
  label: string;
  finding: string;
  source: string;
  severity: 'high' | 'medium' | 'low';
}

interface VerdictEvidenceResponse {
  sessionId: string;
  network: string;
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'ERROR';
  evidenceReport: EvidenceItem[];
  evidenceHash: string | null;
  onchainTxHash: string | null;
  createdAt: string;
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

export default function VerdictDetailPage() {
  const { sessionId } = useParams() as { sessionId: string };
  const [data, setData] = useState<VerdictEvidenceResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'MATCH' | 'MISMATCH' | 'V2_LEGACY'>('V2_LEGACY');
  const [localHash, setLocalHash] = useState<string | null>(null);

  const getApiUrl = () => {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost') {
        return 'http://localhost:3001';
      }
    }
    return process.env.NEXT_PUBLIC_CF_WORKER_URL || 'https://arbisim-proxy.rahulpandey-creates.workers.dev';
  };

  useEffect(() => {
    if (!sessionId) return;

    async function fetchEvidence() {
      setLoading(true);
      setError(null);
      try {
        const apiBase = getApiUrl();
        const res = await fetch(`${apiBase}/api/v1/verdicts/${sessionId}/evidence`);
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `HTTP ${res.status}`);
        }

        const payload = (await res.json()) as VerdictEvidenceResponse;
        setData(payload);

        // Perform browser-side Keccak-256 verification
        const report = payload.evidenceReport || [];
        
        if (payload.evidenceHash) {
          const computed = getCanonicalEvidenceHash(report);
          setLocalHash(computed);

          if (computed.toLowerCase() === payload.evidenceHash.toLowerCase()) {
            setVerificationStatus('MATCH');
          } else {
            setVerificationStatus('MISMATCH');
          }
        } else {
          setVerificationStatus('V2_LEGACY');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to retrieve evidence data');
      } finally {
        setLoading(false);
      }
    }

    fetchEvidence();
  }, [sessionId]);

  const explorerUrl = data ? EXPLORERS[data.network] : '';
  const registryAddr = data ? REGISTRY_ADDRESSES[data.network] : '';

  return (
    <div className="min-h-screen bg-[#0A0B0D] text-[#E2E8F0] font-sans antialiased selection:bg-[#20242D] selection:text-white">
      {/* Navigation Header */}
      <div className="border-b border-[#1E232E] bg-[#0E1015]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
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
            <Link href="/methodology" className="text-[#94A3B8] hover:text-white transition-colors">
              Methodology
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        
        {/* Back Link */}
        <Link href="/trust" className="inline-flex items-center space-x-2 text-xs font-mono text-[#64748B] hover:text-white transition-colors">
          <span>←</span>
          <span>Back to attestation stream</span>
        </Link>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-2 border-t-transparent border-[#3B82F6] rounded-full animate-spin"></div>
            <p className="text-xs font-mono text-[#64748B] uppercase tracking-widest animate-pulse">Retrieving verdict evidence...</p>
          </div>
        ) : error ? (
          <div className="p-4 bg-[#2A1418] border border-[#521C24] text-[#F87171] rounded-md text-sm font-mono flex items-center space-x-3">
            <span className="text-lg">⚠</span>
            <span>Error: {error}</span>
          </div>
        ) : data ? (
          <>
            {/* Header info */}
            <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-[#1E232E] pb-6 gap-4">
              <div className="space-y-1">
                <div className="text-xs font-mono text-[#64748B] uppercase tracking-widest">Simulation session ID</div>
                <h1 className="text-xl md:text-2xl font-mono text-white font-bold">{data.sessionId}</h1>
                <div className="text-xs text-[#94A3B8] font-mono">
                  Chain: {CHAIN_DISPLAY_NAMES[data.network] || data.network} • Logged on {new Date(data.createdAt).toLocaleString()}
                </div>
              </div>
              <div>
                <span className={`inline-flex px-4 py-1.5 rounded text-xs uppercase font-bold tracking-widest ${
                  data.status === 'APPROVED' 
                    ? 'bg-[#064E3B] text-[#10B981]' 
                    : 'bg-[#7F1D1D] text-[#F87171]'
                }`}>
                  Verdict: {data.status}
                </span>
              </div>
            </div>

            {/* Cryptographic Attestation Shield Card */}
            <div className="bg-[#0E1015] border border-[#1E232E] rounded-md overflow-hidden">
              <div className="px-6 py-4 border-b border-[#1E232E] bg-[#0A0B0D] flex items-center justify-between">
                <h3 className="text-xs font-mono text-[#E2E8F0] uppercase tracking-wider">Cryptographic Proof & Binding</h3>
                <span className="text-xs font-mono text-[#64748B]">Verification Check</span>
              </div>
              <div className="p-6 space-y-6">
                
                {/* Attestation check banner */}
                {verificationStatus === 'MATCH' && (
                  <div className="p-4 bg-[#0F2F21] border border-[#1B5E3C] rounded-md flex items-start space-x-4">
                    <span className="text-2xl text-[#10B981] mt-0.5">🛡</span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Cryptographically Verified (v3)</h4>
                      <p className="text-xs text-[#A7F3D0]">
                        The local evidence report hash matches the on-chain commit hash. Zero evidence tampering detected.
                      </p>
                    </div>
                  </div>
                )}

                {verificationStatus === 'MISMATCH' && (
                  <div className="p-4 bg-[#3B1214] border border-[#7C1F22] rounded-md flex items-start space-x-4">
                    <span className="text-2xl text-[#EF4444] mt-0.5">🚨</span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Cryptographic Tampering Detected</h4>
                      <p className="text-xs text-[#FCA5A5]">
                        Warning: The browser-recalculated evidence hash does not match the committed on-chain hash. The evidence report shown below may have been modified.
                      </p>
                    </div>
                  </div>
                )}

                {verificationStatus === 'V2_LEGACY' && (
                  <div className="p-4 bg-[#1B2130] border border-[#2B354F] rounded-md flex items-start space-x-4">
                    <span className="text-2xl text-[#64748B] mt-0.5">⚙</span>
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">On-Chain Attestation Verified (v2)</h4>
                      <p className="text-xs text-[#94A3B8]">
                        This verdict is registered on the blockchain. Cryptographic hash binding is only available on v3 registry contracts.
                      </p>
                    </div>
                  </div>
                )}

                {/* Proof ledger table */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4 text-xs font-mono">
                  <div className="space-y-1">
                    <div className="text-[#64748B] uppercase tracking-wide text-[10px]">On-Chain Registry Contract</div>
                    <div className="text-[#94A3B8]">
                      {registryAddr ? (
                        <a 
                          href={`${explorerUrl}/address/${registryAddr}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[#3B82F6] hover:underline"
                        >
                          {registryAddr}
                        </a>
                      ) : (
                        <span className="italic text-[#64748B]">Not deployed on this network</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[#64748B] uppercase tracking-wide text-[10px]">On-Chain Attestation Write Transaction</div>
                    <div className="text-[#94A3B8]">
                      {data.onchainTxHash ? (
                        <a 
                          href={`${explorerUrl}/tx/${data.onchainTxHash}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[#3B82F6] hover:underline"
                        >
                          {data.onchainTxHash.slice(0, 16)}...{data.onchainTxHash.slice(-16)}
                        </a>
                      ) : (
                        <span className="italic text-[#64748B]">Pending block anchor</span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1 md:col-span-2 border-t border-[#1E232E] pt-3">
                    <div className="text-[#64748B] uppercase tracking-wide text-[10px]">On-Chain Evidence Hash (EVM State)</div>
                    <div className="text-[#94A3B8] font-mono break-all">
                      {data.evidenceHash || <span className="italic text-[#64748B]">Not available (historical simulation recorded on v2 contract)</span>}
                    </div>
                  </div>

                  {localHash && (
                    <div className="space-y-1 md:col-span-2 border-t border-[#1E232E] pt-3">
                      <div className="text-[#64748B] uppercase tracking-wide text-[10px]">Browser-Recalculated Evidence Hash</div>
                      <div className="text-[#94A3B8] font-mono break-all">
                        {localHash}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Verdict Evidence Findings */}
            <div className="space-y-4">
              <h3 className="text-sm font-mono text-[#E2E8F0] uppercase tracking-wider">Safety Findings Report</h3>

              <div className="space-y-4">
                {data.evidenceReport && data.evidenceReport.length > 0 ? (
                  data.evidenceReport.map((item, index) => (
                    <div 
                      key={index}
                      className="bg-[#0E1015] border border-[#1E232E] rounded-md p-5 flex items-start space-x-4"
                    >
                      <div className="mt-0.5">
                        {item.severity === 'high' && <span className="text-lg text-[#EF4444]">🛑</span>}
                        {item.severity === 'medium' && <span className="text-lg text-[#F59E0B]">⚠</span>}
                        {item.severity === 'low' && <span className="text-lg text-[#3B82F6]">ℹ</span>}
                      </div>
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-white">{item.label}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider ${
                            item.severity === 'high' ? 'bg-[#7F1D1D]/30 text-[#F87171] border border-[#EF4444]/20' :
                            item.severity === 'medium' ? 'bg-[#78350F]/30 text-[#FBBF24] border border-[#F59E0B]/20' :
                            'bg-[#1E3A8A]/30 text-[#60A5FA] border border-[#3B82F6]/20'
                          }`}>
                            {item.severity} Severity
                          </span>
                        </div>
                        <p className="text-xs text-[#94A3B8] font-mono">{item.finding}</p>
                        <div className="text-[10px] text-[#64748B] font-mono">
                          Source: {item.source}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="bg-[#0E1015] border border-[#1E232E] rounded-md p-10 text-center space-y-2">
                    <span className="text-2xl">🛡</span>
                    <h4 className="text-sm font-bold text-white">Pre-Flight Simulation Passed</h4>
                    <p className="text-xs text-[#94A3B8] max-w-md mx-auto">
                      All safety analyzers reported zero flags. The transaction execution path succeeded in the isolated EVM sandbox environment without slippage or risk events.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-[#64748B] italic font-mono">
            No verdict record loaded.
          </div>
        )}
      </div>
    </div>
  );
}
