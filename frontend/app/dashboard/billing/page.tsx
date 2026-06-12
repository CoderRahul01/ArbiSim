'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSendTransaction, useAccount, useSwitchChain } from 'wagmi';
import { parseEther } from 'viem';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';
const MERCHANT_ADDRESS = process.env.NEXT_PUBLIC_MERCHANT_ADDRESS ?? '0x4FE1137021102A860Ff374Db8fB13bA78A00f9dD';
const TARGET_CHAIN_ID = Number(process.env.NEXT_PUBLIC_ARBITRUM_CHAIN_ID ?? '42161');

const TIER_LIMITS: Record<string, { monthly: number; label: string }> = {
  free:       { monthly: 500,    label: 'Free' },
  pro:        { monthly: 10000,  label: 'Pro' },
  enterprise: { monthly: 100000, label: 'Enterprise' },
};

function dbTierToUiTier(tier: string): string {
  if (tier === 'builder') return 'pro';
  if (tier === 'protocol') return 'enterprise';
  return tier;
}

function useBillingStats() {
  const [quotaUsed, setQuotaUsed] = useState(0);
  const [quotaLimit, setQuotaLimit] = useState(500);
  const [tier, setTier] = useState('free');

  useEffect(() => {
    const raw = localStorage.getItem('arbisim_api_key') ?? '';
    const key = raw.trim().replace(/[^\x20-\x7E]/g, '');
    if (key) setTier(parseTierFromKey(key));
    if (!key) return;

    fetch(`${CF_WORKER_URL}/api/v1/stats`, { headers: { 'X-API-Key': key } })
      .then(r => r.ok ? r.json() : null)
      .then((data: { quota_used?: number; quota_limit?: number } | null) => {
        if (!data) return;
        setQuotaUsed(data.quota_used ?? 0);
        setQuotaLimit(data.quota_limit ?? 500);
      })
      .catch(() => {});
  }, []);

  return { quotaUsed, quotaLimit, tier };
}

const PLANS = [
  {
    key: 'free',
    name: 'Free',
    price: '$0',
    period: '/month',
    monthly: 500,
    perMin: 10,
    features: [
      'All 8 safety flags',
      'Arbitrum L1+L2 gas breakdown',
      'MEV sandwich detection',
      'Stylus WASM ink tracking',
      'ERC-4337 UserOp support',
      'MCP tool (stdio)',
      'Community support',
    ],
    cta: 'Current plan',
    ctaDisabled: true,
    ctaStyle: 'border border-border text-text-secondary cursor-default',
  },
  {
    key: 'pro',
    name: 'Pro',
    price: '$29',
    period: '/month',
    monthly: 10000,
    perMin: 60,
    highlighted: true,
    features: [
      'Everything in Free',
      'Priority simulation queue',
      'Simulation history & explorer',
      'Shareable simulation receipts',
      'Backtesting suite',
      'Timeboost premium analysis',
      'Webhook callbacks',
      'Email support',
    ],
    cta: 'Upgrade to Pro',
    ctaDisabled: false,
    ctaStyle: 'bg-coral text-white hover:bg-coral-hover shadow-lg shadow-coral/20',
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: '$299',
    period: '/month',
    monthly: 100000,
    perMin: 300,
    features: [
      'Everything in Pro',
      'Custom rate limits',
      'Team / org management',
      'SLA guarantee',
      'Dedicated support',
      'Custom integrations',
    ],
    cta: 'Upgrade to Enterprise',
    ctaDisabled: false,
    ctaStyle: 'border border-border text-text-primary hover:bg-elevated',
  },
];

function loadOnmetaSdk(callback: () => void) {
  if (typeof window === 'undefined') return;
  if ((window as any).onMetaWidget) {
    callback();
    return;
  }
  const script = document.createElement('script');
  script.src = 'https://stg.platform.onmeta.in/onmeta-sdk.js';
  script.async = true;
  script.onload = () => callback();
  document.head.appendChild(script);
}

export default function BillingPage() {
  const { quotaUsed, quotaLimit, tier } = useBillingStats();
  const { sendTransactionAsync } = useSendTransaction();
  const { isConnected, address, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [txStatus, setTxStatus] = useState<{ type: 'idle' | 'signing' | 'confirming' | 'verifying' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const [checkoutPlan, setCheckoutPlan] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'select' | 'onmeta'>('select');
  const [isWidgetLoading, setIsWidgetLoading] = useState(false);

  useEffect(() => {
    if (checkoutPlan && checkoutStep === 'onmeta' && address) {
      setIsWidgetLoading(true);
      loadOnmetaSdk(() => {
        setIsWidgetLoading(false);
        const container = document.getElementById('onmeta-widget-root');
        if (container) {
          container.innerHTML = '';
        }
        
        try {
          const apiKey = process.env.NEXT_PUBLIC_ONMETA_API_KEY || 'onmeta_staging_placeholder_key';
          const isPlaceholder = apiKey === 'onmeta_staging_placeholder_key';
          
          if (isPlaceholder) {
            if (container) {
              container.innerHTML = `
                <div class="flex flex-col items-center justify-center p-8 h-full text-center space-y-4">
                  <div class="p-3 bg-coral/10 rounded-full border border-coral/30">
                    <span style="font-size: 24px; color: var(--accent-coral)">⚙</span>
                  </div>
                  <h3 class="text-sm font-semibold text-text-primary">Staging API Key Required</h3>
                  <p class="text-xs text-text-secondary max-w-xs leading-relaxed">
                    To test the UPI payment widget, please register at 
                    <a href="https://stg.dashboard.onmeta.in" target="_blank" rel="noopener noreferrer" style="color: var(--accent-coral); text-decoration: underline;">
                      stg.dashboard.onmeta.in
                    </a> 
                    and add <code>NEXT_PUBLIC_ONMETA_API_KEY</code> to your <code>.env</code> file.
                  </p>
                  <p class="text-xs text-text-tertiary">
                    Pre-filled Wallet: <code class="bg-elevated px-1.5 py-0.5 rounded font-mono text-[10px]">${address}</code>
                  </p>
                </div>
              `;
            }
            return;
          }

          const widget = new (window as any).onMetaWidget({
            elementId: 'onmeta-widget-root',
            apiKey: apiKey,
            environment: 'staging',
            walletAddress: address,
            chainId: 42161, // Arbitrum One
            fiatAmount: checkoutPlan === 'pro' ? 2500 : 25000,
            fiatCurrency: 'INR',
            tokenSymbol: 'ETH',
          });
          widget.init();
        } catch (e) {
          console.error("Failed to initialize Onmeta widget:", e);
        }
      });
    }
  }, [checkoutPlan, checkoutStep, address]);

  const tierInfo = TIER_LIMITS[tier] ?? TIER_LIMITS['free'];
  const pct = Math.min(100, quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0);
  const quotaWarning = pct > 80;

  async function handleUpgrade(planKey: string) {
    if (!isConnected) {
      setTxStatus({ type: 'error', message: 'Please connect your wallet first.' });
      return;
    }

    const token = localStorage.getItem('arbisim_jwt');
    if (!token) {
      setTxStatus({ type: 'error', message: 'Please sign in first.' });
      return;
    }

    setUpgrading(planKey);
    setTxStatus({ type: 'signing', message: 'Awaiting wallet confirmation...' });

    // pro -> builder, enterprise -> protocol
    const targetDbTier = planKey === 'pro' ? 'builder' : 'protocol';
    const ethAmount = planKey === 'pro' ? '0.009' : '0.09'; // $29 ~ 0.009 ETH, $299 ~ 0.09 ETH

    try {
      // 1. Send transaction
      const txHash = await sendTransactionAsync({
        to: MERCHANT_ADDRESS as `0x${string}`,
        value: parseEther(ethAmount),
      });

      setTxStatus({ type: 'confirming', message: 'Confirming transaction on Arbitrum...' });

      // 2. Call backend to verify and upgrade
      setTxStatus({ type: 'verifying', message: 'Verifying payment onchain and upgrading...' });

      const res = await fetch(`${CF_WORKER_URL}/api/v1/billing/upgrade`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ txHash, tier: targetDbTier }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as any;
        throw new Error(err?.error?.message ?? 'Transaction verification failed.');
      }

      setTxStatus({ type: 'success', message: `Successfully upgraded to ${planKey === 'pro' ? 'Pro' : 'Enterprise'}!` });
      setTimeout(() => window.location.reload(), 2000);
    } catch (err: any) {
      console.error(err);
      setTxStatus({ type: 'error', message: err.message || 'Payment or verification failed.' });
    } finally {
      setUpgrading(null);
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center">
          <h1 className="text-sm font-semibold text-text-primary">Billing</h1>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-5xl w-full mx-auto space-y-8">

        {/* Transaction Status Banner */}
        {txStatus.type !== 'idle' && (
          <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 animate-slide-up ${
            txStatus.type === 'success' ? 'bg-teal/10 border-teal/30 text-teal' :
            txStatus.type === 'error' ? 'bg-danger/10 border-danger/30 text-danger' :
            'bg-coral/10 border-coral/30 text-coral'
          }`}>
            <div className="flex items-center gap-3">
              {(txStatus.type === 'signing' || txStatus.type === 'confirming' || txStatus.type === 'verifying') && (
                <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent rounded-full" />
              )}
              {txStatus.type === 'success' && <span>✓</span>}
              {txStatus.type === 'error' && <span>⚠</span>}
              <span className="text-sm font-medium">{txStatus.message}</span>
            </div>
            {txStatus.type === 'error' && (
              <button onClick={() => setTxStatus({ type: 'idle' })} className="text-xs font-mono underline hover:no-underline">Dismiss</button>
            )}
          </div>
        )}

        {/* Current plan + usage */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Current plan card */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-4">Current plan</p>
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-2xl font-semibold text-text-primary">{tierInfo.label}</p>
                <p className="text-sm text-text-secondary mt-0.5">{PLANS.find(p => p.key === tier)?.price ?? '$0'} / month</p>
              </div>
              <span className="px-2.5 py-1 rounded border border-teal/30 bg-teal/5 text-xs font-mono text-teal">active</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-text-tertiary">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-teal shrink-0">
                <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M3.5 6l1.5 1.5L8.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Renews automatically · no credit card required
            </div>
          </div>

          {/* Usage card */}
          <div className="rounded-xl border border-border bg-surface p-6">
            <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-4">This month&apos;s usage</p>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-text-secondary">Simulations used</span>
                  <span className={`text-xs font-mono ${quotaWarning ? 'text-amber' : 'text-text-tertiary'}`}>
                    {quotaUsed.toLocaleString()} / {quotaLimit.toLocaleString()}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-elevated border border-border overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${quotaWarning ? 'bg-amber' : 'bg-coral/60'}`}
                    style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }}
                  />
                </div>
              </div>
            </div>
            <p className="text-xs text-text-tertiary mt-4">
              Usage resets on the 1st of each month.
            </p>
          </div>
        </div>

        {/* Plan comparison */}
        <div>
          <h2 className="text-sm font-semibold text-text-primary mb-4">Plans</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {PLANS.map(plan => {
              const isCurrent = plan.key === tier;
              return (
                <div key={plan.name}
                  className={`rounded-xl border p-6 flex flex-col gap-5 transition-all duration-300 ${
                    plan.highlighted
                      ? 'border-coral/30 bg-gradient-to-b from-coral/5 to-surface'
                      : 'border-border bg-surface'
                  }`}>
                  {plan.highlighted && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 px-2 py-0.5 rounded">Most popular</span>
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">{plan.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-semibold text-text-primary">{plan.price}</span>
                      <span className="text-sm text-text-tertiary">{plan.period}</span>
                    </div>
                    <p className="text-xs text-text-secondary mt-1.5 font-mono">
                      {plan.monthly.toLocaleString()} sims/month · {plan.perMin}/min
                    </p>
                  </div>

                  <ul className="space-y-2 flex-1">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-2 text-xs text-text-secondary">
                        <span className="text-teal mt-0.5 shrink-0">✓</span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    disabled={isCurrent || upgrading !== null}
                    onClick={() => {
                      if (!isConnected) {
                        setTxStatus({ type: 'error', message: 'Please connect your wallet first.' });
                        return;
                      }
                      const token = localStorage.getItem('arbisim_jwt');
                      if (!token) {
                        setTxStatus({ type: 'error', message: 'Please sign in first.' });
                        return;
                      }
                      setCheckoutPlan(plan.key);
                      setCheckoutStep('select');
                    }}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-70 disabled:cursor-default ${
                      isCurrent ? 'border border-border text-text-secondary cursor-default' : plan.ctaStyle
                    }`}>
                    {isCurrent ? 'Current plan' : upgrading === plan.key ? 'Processing...' : plan.cta}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-4">Billing FAQ</h3>
          <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
            {[
              {
                q: 'What counts as a simulation?',
                a: 'Each POST to /v1/simulate counts as one simulation, regardless of transaction count in the batch.',
              },
              {
                q: 'Is my transaction ever broadcast?',
                a: 'Never. All simulations run in an ephemeral Anvil fork that is discarded immediately after the simulation completes.',
              },
              {
                q: 'Can I change plans at any time?',
                a: 'Yes — upgrades are effective immediately and prorated. Downgrades take effect at the start of the next billing period.',
              },
              {
                q: 'Do unused simulations roll over?',
                a: 'No. Monthly limits reset on the 1st of each month.',
              },
            ].map(item => (
              <div key={item.q}>
                <p className="text-xs font-semibold text-text-primary mb-1">{item.q}</p>
                <p className="text-xs text-text-secondary leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Enterprise CTA */}
        <div className="rounded-xl border border-border bg-elevated p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-text-primary mb-1">Need higher limits?</p>
            <p className="text-xs text-text-secondary">Enterprise plans with custom limits, SLA, webhooks, and team access. Ideal for protocols and quant funds.</p>
          </div>
          <Link href="mailto:hello@arbisimguard.com"
            className="shrink-0 px-5 py-2.5 rounded-lg border border-border text-sm font-medium text-text-primary hover:bg-surface hover:border-zinc-600 transition-all duration-150 whitespace-nowrap">
            Talk to us →
          </Link>
        </div>

      </div>

      {/* Checkout Modal (Flow A - UPI Top-up / Crypto Direct payment) */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-base/90 backdrop-blur-md" onClick={() => setCheckoutPlan(null)} />
          <div className="glass relative w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-slide-up flex flex-col max-h-[90vh] z-10">
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-border/50 pb-4">
              <div>
                <h2 className="text-base font-semibold text-text-primary">
                  Upgrade to {checkoutPlan === 'pro' ? 'Pro' : 'Enterprise'}
                </h2>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Choose your payment route to unlock higher limits.
                </p>
              </div>
              <button onClick={() => setCheckoutPlan(null)} className="text-text-tertiary hover:text-text-primary transition-colors text-xl leading-none">×</button>
            </div>

            {checkoutStep === 'select' ? (
              <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                {/* Info alert */}
                <div className="p-3 bg-coral/5 border border-coral/20 rounded-lg text-xs text-text-secondary flex gap-2">
                  <span className="text-coral shrink-0">ⓘ</span>
                  <span>
                    ArbiSim Guard receives all payments directly in our merchant address (MetaMask). You can top up your wallet with UPI first, or pay directly if you have ETH on Arbitrum.
                  </span>
                </div>

                <div className="grid gap-4">
                  {/* Option 1: Direct crypto payment */}
                  <div className="p-4 rounded-xl border border-border/60 bg-elevated/40 hover:bg-elevated/80 transition-all duration-200 group flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-text-tertiary uppercase tracking-wider">Option 1</span>
                        <span className="text-[10px] font-mono text-teal bg-teal/10 border border-teal/20 px-1.5 py-0.5 rounded">Native Web3</span>
                      </div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-coral transition-colors mb-1">
                        Pay with Crypto Balance (Arbitrum ETH)
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed mb-4">
                        If you already have ETH in your wallet on Arbitrum One, sign a quick transaction to pay the equivalent of {checkoutPlan === 'pro' ? '$29 (~0.009 ETH)' : '$299 (~0.09 ETH)'}.
                      </p>
                    </div>
                    {chainId !== TARGET_CHAIN_ID ? (
                      <button
                        onClick={() => switchChain({ chainId: TARGET_CHAIN_ID })}
                        className="w-full py-2.5 bg-amber text-zinc-950 text-xs font-semibold rounded-lg hover:bg-amber-hover transition-all duration-150 active:scale-[0.98] shadow-md shadow-amber/15"
                      >
                        Switch Wallet to {TARGET_CHAIN_ID === 42161 ? 'Arbitrum One' : 'Arbitrum Sepolia'}
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setCheckoutPlan(null);
                          handleUpgrade(checkoutPlan);
                        }}
                        className="w-full py-2 bg-coral text-white text-xs font-medium rounded-lg hover:bg-coral-hover shadow-md shadow-coral/15 transition-all duration-150 active:scale-[0.98]"
                      >
                        Pay {checkoutPlan === 'pro' ? '0.009' : '0.09'} ETH Now
                      </button>
                    )}
                  </div>

                  {/* Option 2: Buy crypto using UPI via Onmeta */}
                  <div className="p-4 rounded-xl border border-border/60 bg-elevated/40 hover:bg-elevated/80 transition-all duration-200 group flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-text-tertiary uppercase tracking-wider">Option 2</span>
                        <span className="text-[10px] font-mono text-coral bg-coral/10 border border-coral/20 px-1.5 py-0.5 rounded">UPI Top-up</span>
                      </div>
                      <h3 className="text-sm font-semibold text-text-primary group-hover:text-coral transition-colors mb-1">
                        Top up via UPI (Onmeta)
                      </h3>
                      <p className="text-xs text-text-secondary leading-relaxed mb-4">
                        Buy Arbitrum ETH using INR directly via UPI (Google Pay, PhonePe, Paytm, etc.). The purchased ETH goes straight to your connected wallet, and then you can click Option 1.
                      </p>
                    </div>
                    <button
                      onClick={() => setCheckoutStep('onmeta')}
                      className="w-full py-2 border border-coral/30 hover:border-coral/60 text-coral bg-coral/5 text-xs font-medium rounded-lg transition-all duration-150 active:scale-[0.98]"
                    >
                      Buy ETH with UPI
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col min-h-[500px]">
                {/* Back button */}
                <button
                  onClick={() => setCheckoutStep('select')}
                  className="mb-4 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors flex items-center gap-1.5 self-start"
                >
                  ← Back to options
                </button>

                {/* Onmeta container */}
                <div className="flex-1 w-full bg-base/40 rounded-xl border border-border/60 overflow-hidden relative min-h-[460px]">
                  {isWidgetLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-base/80 z-10 gap-3">
                      <div className="animate-spin w-6 h-6 border-2 border-coral border-t-transparent rounded-full" />
                      <p className="text-xs font-mono text-text-tertiary">Loading Onmeta Widget...</p>
                    </div>
                  )}
                  <div id="onmeta-widget-root" className="w-full h-full min-h-[460px]" />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
