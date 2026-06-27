'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { parseUnits } from 'viem';
import { SUPPORTED_NETWORKS } from '../../../lib/chains';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? '';

// ── Calldata helpers ───────────────────────────────────────────────────────

function padHex(hex: string, bytes: number): string {
  return hex.replace('0x', '').padStart(bytes * 2, '0');
}

function encodeERC20Transfer(to: string, amount: bigint): string {
  const selector = 'a9059cbb';
  const paddedTo = padHex(to, 32);
  const paddedAmount = padHex(amount.toString(16), 32);
  return '0x' + selector + paddedTo + paddedAmount;
}

// ── Flag config ────────────────────────────────────────────────────────────

const FLAG_LABELS: Record<string, string> = {
  revert: 'Revert detected',
  execution_reverted: 'Revert detected',
  high_slippage: 'High slippage',
  mev_risk: 'MEV risk',
  sandwich_detected: 'MEV risk',
  gas_estimate_high: 'High gas estimate',
  low_reputation: 'Low agent reputation',
  low_agent_reputation: 'Low agent reputation',
  unknown_agent: 'Unknown agent',
  price_impact_high: 'High price impact',
  bridge_risk: 'Bridge risk',
  oracle_manipulation: 'Oracle manipulation',
  value_transfer: 'Value transfer',
  contract_creation: 'Contract creation',
  unsafe_allowance: 'Unsafe allowance',
  sig_failed: 'Signature failed',
  valid_until_expired: 'Intent expired',
  x402_payment_risk: 'x402 payment risk',
  timeboost_recommended: 'TimeBoot recommended',
};

const DANGER_KEYS = new Set([
  'revert', 'execution_reverted', 'mev_risk', 'sandwich_detected',
  'sig_failed', 'valid_until_expired', 'oracle_manipulation', 'low_reputation',
  'low_agent_reputation', 'unknown_agent', 'x402_payment_risk',
]);

const WARNING_KEYS = new Set([
  'high_slippage', 'gas_estimate_high', 'price_impact_high', 'bridge_risk',
  'unsafe_allowance', 'timeboost_recommended',
]);

// ── Types ──────────────────────────────────────────────────────────────────

type ActionType = 'eth_transfer' | 'erc20_transfer' | 'token_swap' | 'contract_call' | 'custom';

interface SimResult {
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'ERROR';
  sessionId?: string;
  session_id?: string;
  gasCostEth?: string;
  slippagePercent?: number;
  flags?: Record<string, boolean>;
  revertReason?: string | null;
  error?: string;
  network?: string;
}

// ── Verdict card ───────────────────────────────────────────────────────────

function VerdictCard({ result, network }: { result: SimResult; network: string }) {
  const [permalinkCopied, setPermalinkCopied] = useState(false);
  const sessionId = result.sessionId ?? result.session_id;
  const chain = SUPPORTED_NETWORKS[network];
  const token = chain?.nativeToken ?? 'ETH';

  // Compute verdict
  const activeFlags = Object.entries(result.flags ?? {})
    .filter(([, v]) => v)
    .map(([k]) => k);
  const hasDanger = activeFlags.some(k => DANGER_KEYS.has(k));

  let verdict: 'SAFE' | 'WARNING' | 'BLOCKED' = 'SAFE';
  if (result.status === 'REJECTED') {
    verdict = hasDanger ? 'BLOCKED' : 'WARNING';
  } else if (result.status === 'APPROVED' && hasDanger) {
    verdict = 'WARNING';
  }

  const verdictStyles = {
    SAFE:    { bg: 'bg-teal/8 border-teal/25', icon: '✅', label: 'SAFE', sub: 'Safe to execute', text: 'text-teal' },
    WARNING: { bg: 'bg-amber/8 border-amber/25', icon: '⚠️', label: 'WARNING', sub: 'Review before executing', text: 'text-amber' },
    BLOCKED: { bg: 'bg-red-950/30 border-red-800/30', icon: '❌', label: 'BLOCKED', sub: 'Do not execute', text: 'text-red-400' },
  }[verdict];

  function copyPermalink() {
    if (!sessionId) return;
    const url = `${APP_URL}/sim/${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setPermalinkCopied(true);
      setTimeout(() => setPermalinkCopied(false), 2000);
    });
  }

  if (result.status === 'ERROR') {
    return (
      <div className="rounded-xl border border-red-800/30 bg-red-950/20 p-5 animate-slide-up">
        <p className="text-xs font-mono text-text-tertiary mb-1">Error</p>
        <p className="text-sm text-red-400 font-mono">{result.error}</p>
      </div>
    );
  }

  if (result.status === 'PENDING') {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 flex flex-col items-center gap-3 animate-fade-in">
        <div className="w-8 h-8 border-2 border-amber border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-text-secondary">Forking chain and executing transaction…</p>
      </div>
    );
  }

  return (
    <div className={`rounded-xl border ${verdictStyles.bg} overflow-hidden animate-slide-up`}>
      {/* Verdict header */}
      <div className="px-6 py-5 border-b border-white/5">
        <div className="flex items-center gap-3 mb-1">
          <span className="text-2xl">{verdictStyles.icon}</span>
          <span className={`text-xl font-bold ${verdictStyles.text}`}>{verdictStyles.label}</span>
        </div>
        <p className="text-sm text-text-secondary">{verdictStyles.sub}</p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 divide-x divide-white/5 border-b border-white/5">
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-text-tertiary mb-1">Gas estimate</p>
          <p className="text-sm font-mono font-medium text-text-primary">
            {result.gasCostEth ? `~${result.gasCostEth} ${token}` : '—'}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-text-tertiary mb-1">Slippage</p>
          <p className="text-sm font-mono font-medium text-text-primary">
            {result.slippagePercent != null ? `${result.slippagePercent.toFixed(2)}%` : '—'}
          </p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xs text-text-tertiary mb-1">Chain</p>
          <p className="text-sm font-mono font-medium text-text-primary">
            {chain?.displayName ?? network}
          </p>
        </div>
      </div>

      {/* Flags */}
      {activeFlags.length > 0 && (
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-xs font-mono text-text-tertiary mb-2.5">Safety flags</p>
          <div className="flex flex-wrap gap-2">
            {activeFlags.map(k => {
              const isDanger = DANGER_KEYS.has(k);
              const isWarn = WARNING_KEYS.has(k);
              return (
                <span
                  key={k}
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    isDanger
                      ? 'bg-red-950/40 border-red-800/40 text-red-400'
                      : isWarn
                      ? 'bg-amber/8 border-amber/30 text-amber'
                      : 'bg-elevated border-border text-text-secondary'
                  }`}
                >
                  {FLAG_LABELS[k] ?? k.replace(/_/g, ' ')}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Revert reason */}
      {result.revertReason && (
        <div className="px-5 py-4 border-b border-white/5">
          <p className="text-xs font-mono text-text-tertiary mb-2">Revert reason</p>
          <pre className="text-xs font-mono text-red-300 bg-red-950/30 border border-red-800/20 rounded-lg px-3 py-2.5 overflow-x-auto whitespace-pre-wrap">
            {result.revertReason}
          </pre>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-4 flex items-center gap-3">
        {sessionId && (
          <>
            <button
              onClick={copyPermalink}
              className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all ${
                permalinkCopied
                  ? 'border-teal/30 bg-teal/10 text-teal'
                  : 'border-border bg-elevated text-text-tertiary hover:text-text-primary'
              }`}
            >
              {permalinkCopied ? '✓ Link copied' : '⟳ Share permalink'}
            </button>
            <Link
              href={`/sim/${sessionId}`}
              className="text-xs font-mono text-coral hover:text-coral-hover transition-colors"
            >
              View full report →
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

// ── Input helpers ──────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2">
      {children}
    </label>
  );
}

function TextInput({
  value, onChange, placeholder, mono = true,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={`w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors ${mono ? 'font-mono' : ''}`}
    />
  );
}

function NumberInput({
  value, onChange, placeholder, step = '0.01',
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; step?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      step={step}
      min="0"
      className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
    />
  );
}

// ── Main page ──────────────────────────────────────────────────────────────

const STUDIO_CHAINS = ['arbitrum-one', 'arbitrum-sepolia', 'avalanche-mainnet', 'avalanche-fuji'];

export default function StudioPage() {
  const { address } = useAccount();

  const [network, setNetwork] = useState('arbitrum-one');
  const [fromAddress, setFromAddress] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [value, setValue] = useState('');
  const [action, setAction] = useState<ActionType>('eth_transfer');

  // ERC-20 Transfer
  const [tokenAddress, setTokenAddress] = useState('');
  const [tokenRecipient, setTokenRecipient] = useState('');
  const [tokenAmount, setTokenAmount] = useState('');
  const [tokenDecimals, setTokenDecimals] = useState('18');

  // Token Swap
  const [tokenIn, setTokenIn] = useState('');
  const [tokenOut, setTokenOut] = useState('');
  const [swapAmount, setSwapAmount] = useState('');
  const [slippage, setSlippage] = useState('2.0');

  // Contract Call / Custom
  const [selector, setSelector] = useState('');
  const [calldata, setCalldata] = useState('');

  const [apiKey, setApiKey] = useState('');
  const [result, setResult] = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(false);

  const chain = SUPPORTED_NETWORKS[network];
  const token = chain?.nativeToken ?? 'ETH';

  // Pre-fill from wallet
  useEffect(() => {
    if (address && !fromAddress) setFromAddress(address);
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load API key from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('arbisim_api_key') ?? '';
    setApiKey(stored.trim().replace(/[^\x20-\x7E]/g, ''));
  }, []);

  // Build transaction payload
  const buildPayload = useCallback(() => {
    const valueWei = value
      ? parseUnits(value, 18).toString()
      : '0';

    let txTo = toAddress;
    let txData = '0x';
    let txValue = valueWei;
    const maxSlippage = parseFloat(slippage) || 2.0;

    if (action === 'eth_transfer') {
      txData = '0x';
      txTo = toAddress;
      txValue = valueWei;
    } else if (action === 'erc20_transfer') {
      txTo = tokenAddress;
      txValue = '0';
      const decimals = parseInt(tokenDecimals) || 18;
      const amt = tokenAmount
        ? parseUnits(tokenAmount, decimals)
        : BigInt(0);
      txData = encodeERC20Transfer(tokenRecipient || fromAddress, amt);
    } else if (action === 'token_swap') {
      // For swaps: user provides router as "toAddress", minimal calldata hint
      txTo = toAddress;
      txValue = valueWei;
      txData = calldata || '0x';
    } else if (action === 'contract_call') {
      txTo = toAddress;
      txValue = valueWei;
      const rawCalldata = calldata.startsWith('0x') ? calldata : '0x' + calldata;
      txData = selector
        ? (selector.startsWith('0x') ? selector : '0x' + selector) + rawCalldata.slice(2)
        : rawCalldata;
    } else {
      // custom
      txTo = toAddress;
      txValue = valueWei;
      txData = calldata.startsWith('0x') ? calldata : '0x' + calldata;
    }

    return {
      network,
      agent_address: fromAddress,
      transactions: [{ to: txTo, data: txData, value: txValue }],
      max_slippage_tolerance: maxSlippage,
    };
  }, [action, network, fromAddress, toAddress, value, slippage, tokenAddress, tokenRecipient,
      tokenAmount, tokenDecimals, calldata, selector]);

  const handleSimulate = useCallback(async () => {
    const cleanKey = apiKey.trim().replace(/[^\x20-\x7E]/g, '');
    if (!cleanKey) {
      setResult({ status: 'ERROR', error: 'Enter your API key - or visit the API Keys page to get one.' });
      return;
    }
    if (!fromAddress) {
      setResult({ status: 'ERROR', error: 'From address is required.' });
      return;
    }

    let payload: ReturnType<typeof buildPayload>;
    try {
      payload = buildPayload();
    } catch (e: unknown) {
      setResult({ status: 'ERROR', error: e instanceof Error ? e.message : 'Invalid input' });
      return;
    }

    setLoading(true);
    setResult({ status: 'PENDING' });

    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/simulate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': cleanKey },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string | { message?: string } };
        const msg = typeof err.error === 'string' ? err.error : (err.error as { message?: string })?.message ?? `HTTP ${res.status}`;
        setResult({ status: 'ERROR', error: msg });
        return;
      }

      const data = await res.json() as SimResult;
      const sessionId = data.sessionId ?? data.session_id;

      if (sessionId && data.status === 'PENDING') {
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 3000));
          const poll = await fetch(`${CF_WORKER_URL}/api/v1/simulate/${sessionId}`, {
            headers: { 'X-API-Key': cleanKey },
          }).catch(() => null);
          if (!poll?.ok) continue;
          const pollData = await poll.json() as SimResult;
          if (pollData.status !== 'PENDING') { setResult(pollData); return; }
        }
        setResult({ status: 'ERROR', error: 'Simulation timed out after 90 seconds.' });
      } else {
        setResult(data);
      }
    } catch (err: unknown) {
      setResult({ status: 'ERROR', error: err instanceof Error ? err.message : 'Network error' });
    } finally {
      setLoading(false);
    }
  }, [apiKey, fromAddress, buildPayload]);

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 h-14 flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">Simulation Studio</span>
          <span className="text-xs text-text-tertiary font-mono">plain-English simulation - no JSON required</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* ── Left: Form ─────────────────────────────────────────── */}
          <div className="space-y-5">
            {/* Chain */}
            <div>
              <Label>Chain</Label>
              <div className="flex flex-wrap gap-2">
                {STUDIO_CHAINS.map(id => {
                  const n = SUPPORTED_NETWORKS[id];
                  return (
                    <button
                      key={id}
                      onClick={() => { setNetwork(id); setResult(null); }}
                      className={`relative inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-mono transition-all ${
                        network === id
                          ? 'border-coral/60 bg-coral/10 text-coral font-medium'
                          : 'border-border bg-surface text-text-tertiary hover:border-coral/30 hover:text-text-secondary'
                      }`}
                    >
                      {n.displayName}
                      {n.badge && (
                        <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30">
                          {n.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Key */}
            <div>
              <Label>API Key</Label>
              <input
                type="text"
                value={apiKey}
                onChange={e => {
                  const s = e.target.value.replace(/[^\x20-\x7E]/g, '');
                  setApiKey(s);
                  localStorage.setItem('arbisim_api_key', s);
                }}
                placeholder="ask_free_••••••••••••"
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
              />
            </div>

            {/* From / To */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>From address</Label>
                <TextInput value={fromAddress} onChange={setFromAddress} placeholder="0x…" />
              </div>
              {action !== 'erc20_transfer' && (
                <div>
                  <Label>To address</Label>
                  <TextInput value={toAddress} onChange={setToAddress} placeholder="0x…" />
                </div>
              )}
            </div>

            {/* Value (ETH/AVAX) - not shown for ERC-20 */}
            {action !== 'erc20_transfer' && action !== 'token_swap' && (
              <div>
                <Label>Value ({token})</Label>
                <NumberInput value={value} onChange={setValue} placeholder="0.0" />
              </div>
            )}

            {/* Action selector */}
            <div>
              <Label>Action</Label>
              <select
                value={action}
                onChange={e => { setAction(e.target.value as ActionType); setResult(null); }}
                className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary text-sm focus:outline-none focus:border-coral/50 transition-colors"
              >
                <option value="eth_transfer">{token} Transfer</option>
                <option value="erc20_transfer">ERC-20 Transfer</option>
                <option value="token_swap">Token Swap</option>
                <option value="contract_call">Contract Call</option>
                <option value="custom">Custom Calldata</option>
              </select>
            </div>

            {/* Conditional fields */}
            {action === 'erc20_transfer' && (
              <div className="space-y-4 px-4 py-4 rounded-xl border border-border bg-elevated/40">
                <div>
                  <Label>Token contract</Label>
                  <TextInput value={tokenAddress} onChange={setTokenAddress} placeholder="0x… (USDC, etc.)" />
                </div>
                <div>
                  <Label>Recipient</Label>
                  <TextInput value={tokenRecipient} onChange={setTokenRecipient} placeholder="0x…" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount</Label>
                    <NumberInput value={tokenAmount} onChange={setTokenAmount} placeholder="100" step="1" />
                  </div>
                  <div>
                    <Label>Decimals</Label>
                    <NumberInput value={tokenDecimals} onChange={setTokenDecimals} placeholder="18" step="1" />
                  </div>
                </div>
              </div>
            )}

            {action === 'token_swap' && (
              <div className="space-y-4 px-4 py-4 rounded-xl border border-border bg-elevated/40">
                <p className="text-xs text-text-tertiary font-mono">Set the router as <span className="text-text-secondary">To address</span> above, then add calldata below.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Token In</Label>
                    <TextInput value={tokenIn} onChange={setTokenIn} placeholder="0x… (USDC)" />
                  </div>
                  <div>
                    <Label>Token Out</Label>
                    <TextInput value={tokenOut} onChange={setTokenOut} placeholder="0x… (WETH)" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Amount In</Label>
                    <NumberInput value={swapAmount} onChange={setSwapAmount} placeholder="100" step="1" />
                  </div>
                  <div>
                    <Label>Max slippage %</Label>
                    <NumberInput value={slippage} onChange={setSlippage} placeholder="2.0" step="0.1" />
                  </div>
                </div>
                <div>
                  <Label>Swap calldata (from DEX UI)</Label>
                  <textarea
                    value={calldata}
                    onChange={e => setCalldata(e.target.value)}
                    rows={3}
                    placeholder="0x38ed1739…"
                    spellCheck={false}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {action === 'contract_call' && (
              <div className="space-y-4 px-4 py-4 rounded-xl border border-border bg-elevated/40">
                <div>
                  <Label>Function selector (4 bytes)</Label>
                  <TextInput value={selector} onChange={setSelector} placeholder="0x38ed1739" />
                </div>
                <div>
                  <Label>Encoded arguments</Label>
                  <textarea
                    value={calldata}
                    onChange={e => setCalldata(e.target.value)}
                    rows={4}
                    placeholder="ABI-encoded arguments (without selector)…"
                    spellCheck={false}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {action === 'custom' && (
              <div className="space-y-4 px-4 py-4 rounded-xl border border-border bg-elevated/40">
                <div>
                  <Label>Raw calldata</Label>
                  <textarea
                    value={calldata}
                    onChange={e => setCalldata(e.target.value)}
                    rows={5}
                    placeholder="0x…"
                    spellCheck={false}
                    className="w-full px-4 py-2.5 rounded-lg border border-border bg-surface text-text-primary font-mono text-xs placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors resize-none"
                  />
                </div>
              </div>
            )}

            {/* Simulate button */}
            <button
              onClick={handleSimulate}
              disabled={loading}
              className="w-full py-3.5 bg-coral text-white rounded-xl font-medium text-sm hover:bg-coral/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-200 active:scale-[0.99] shadow-lg shadow-coral/25 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Simulating on {chain?.displayName}…
                </>
              ) : (
                `Simulate on ${chain?.displayName}`
              )}
            </button>

            <p className="text-xs text-text-tertiary text-center">
              No real transaction is submitted - runs against an ephemeral {chain?.displayName} fork.
            </p>
          </div>

          {/* ── Right: Results ─────────────────────────────────────── */}
          <div>
            {!result ? (
              <div className="rounded-xl border border-border bg-surface h-full flex flex-col items-center justify-center gap-4 py-20 text-center px-8 min-h-[320px]">
                <div className="w-12 h-12 rounded-xl bg-coral/10 border border-coral/20 flex items-center justify-center text-coral text-2xl">⬡</div>
                <p className="text-text-primary font-medium">Verdict appears here</p>
                <p className="text-sm text-text-tertiary max-w-xs">
                  Fill in the form, hit Simulate - get a ✅ SAFE, ⚠️ WARNING, or ❌ BLOCKED verdict instantly.
                </p>
                <Link
                  href="/dashboard/simulate"
                  className="text-xs font-mono text-coral/70 hover:text-coral transition-colors"
                >
                  Need raw JSON control? → Live Simulation
                </Link>
              </div>
            ) : (
              <VerdictCard result={result} network={network} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
