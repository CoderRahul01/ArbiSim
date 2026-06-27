'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

interface ApiKey {
  id: string;
  prefix: string;
  tier: string;
  hash: string;
  active: boolean;
  fullKey?: string;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all duration-200 shrink-0 ${
        copied
          ? 'border-teal/40 bg-teal/10 text-teal'
          : 'border-border bg-elevated text-text-tertiary hover:text-text-primary hover:border-border/80'
      }`}
    >
      {copied ? '✓ copied' : label}
    </button>
  );
}

function CheckItem({ done, label, sub }: { done: boolean; label: string; sub?: string }) {
  return (
    <div className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all duration-300 ${
      done ? 'border-teal/30 bg-teal/5' : 'border-border bg-surface'
    }`}>
      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
        done ? 'border-teal bg-teal' : 'border-border'
      }`}>
        {done && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-teal' : 'text-text-primary'}`}>{label}</p>
        {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function SetupPage() {
  const { isConnected } = useAccount();
  const { open } = useAppKit();

  const [jwt, setJwt] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [simCount, setSimCount] = useState(0);
  const [configCopied, setConfigCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth check — mirrors dashboard/layout.tsx pattern
  useEffect(() => {
    const token = localStorage.getItem('arbisim_jwt');
    if (!token) { setJwt(null); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('arbisim_jwt');
        setJwt(null);
      } else {
        setJwt(token);
      }
    } catch {
      setJwt(null);
    }
  }, [isConnected]);

  const fetchOrCreateKey = useCallback(async (token: string) => {
    setLoading(true);
    setError('');
    try {
      // Try to get existing key from localStorage first
      const stored = localStorage.getItem('arbisim_api_key')?.trim();
      if (stored && stored.startsWith('ask_')) {
        setApiKey(stored);
        setLoading(false);
        return;
      }

      // List keys
      const res = await fetch(`${CF_WORKER_URL}/api/v1/keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch keys');
      const keys: ApiKey[] = await res.json();
      const active = keys.filter(k => k.active);

      if (active.length > 0) {
        // We have the prefix but not the full key — prompt user to copy from API Keys page
        setApiKey(active[0].prefix);
      } else {
        // Auto-create a free key
        const create = await fetch(`${CF_WORKER_URL}/api/v1/keys`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tier: 'free', name: 'setup-auto' }),
        });
        if (!create.ok) throw new Error('Failed to create API key');
        const newKey: ApiKey = await create.json();
        if (newKey.fullKey) {
          localStorage.setItem('arbisim_api_key', newKey.fullKey);
          setApiKey(newKey.fullKey);
        }
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async (key: string) => {
    if (!key || key.includes('•')) return; // prefix-only, no real key
    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/stats`, {
        headers: { 'X-API-Key': key },
      });
      if (res.ok) {
        const data: { today?: number } = await res.json();
        setSimCount(data.today ?? 0);
      }
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    if (jwt) {
      fetchOrCreateKey(jwt);
    }
  }, [jwt, fetchOrCreateKey]);

  useEffect(() => {
    if (apiKey && !apiKey.includes('•')) {
      fetchStats(apiKey);
    }
  }, [apiKey, fetchStats]);

  const isFullKey = apiKey && !apiKey.includes('•');
  const workerUrl = CF_WORKER_URL;

  const claudeConfig = JSON.stringify({
    mcpServers: {
      'arbisim-guard': {
        type: 'sse',
        url: `${workerUrl}/mcp/sse?api_key=${isFullKey ? apiKey : 'YOUR_API_KEY'}`,
      },
    },
  }, null, 2);

  const steps = [
    {
      done: isConnected && !!jwt,
      label: 'Wallet connected & signed in',
      sub: 'SIWE authentication complete',
    },
    {
      done: !!apiKey,
      label: 'API key generated',
      sub: isFullKey ? apiKey.slice(0, 16) + '••••' : (apiKey || 'Pending…'),
    },
    {
      done: configCopied,
      label: 'MCP config copied',
      sub: 'Paste into Claude Desktop or Cursor',
    },
    {
      done: simCount > 0,
      label: 'First simulation run',
      sub: simCount > 0 ? `${simCount} simulation${simCount > 1 ? 's' : ''} today` : 'Run a simulation to complete setup',
    },
  ];

  const completedCount = steps.filter(s => s.done).length;

  // Not connected state
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-coral/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 bg-blue-500/8 rounded-full blur-[120px] pointer-events-none" />
        <div className="glass max-w-sm w-full rounded-2xl p-8 border border-border shadow-2xl flex flex-col items-center text-center relative z-10 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-coral/10 border border-coral/20 flex items-center justify-center mb-5 shadow-lg shadow-coral/10">
            <Image src="/logo.png" alt="ArbiSim Guard" width={36} height={36} className="rounded-lg" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Connect to get started</h2>
          <p className="text-sm text-text-secondary mb-7 leading-relaxed">
            Connect your wallet to auto-generate your API key and MCP config.
          </p>
          <div className="w-full flex justify-center">
            <appkit-button />
          </div>
        </div>
      </div>
    );
  }

  // Connected but no JWT
  if (isConnected && !jwt) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/4 left-1/3 w-80 h-80 bg-coral/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="glass max-w-sm w-full rounded-2xl p-8 border border-border shadow-2xl flex flex-col items-center text-center relative z-10 animate-slide-up">
          <div className="w-14 h-14 rounded-2xl bg-coral/10 border border-coral/20 flex items-center justify-center mb-5">
            <Image src="/logo.png" alt="ArbiSim Guard" width={36} height={36} className="rounded-lg" />
          </div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Sign to authenticate</h2>
          <p className="text-sm text-text-secondary mb-7 leading-relaxed">
            Sign a message to prove wallet ownership and generate your API key.
          </p>
          <button
            onClick={() => open({ view: 'Account' })}
            className="w-full py-3 rounded-xl bg-coral text-white text-sm font-semibold hover:bg-coral/90 shadow-lg shadow-coral/25 transition-all duration-150 active:scale-[0.98]"
          >
            Sign Authentication Message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base">
      {/* Header */}
      <div className="border-b border-border bg-surface/60 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <Image src="/logo.png" alt="ArbiSim Guard" width={22} height={22} className="rounded-md shadow-sm shadow-coral/30" />
            <span className="font-semibold text-text-primary text-sm">ArbiSim Guard</span>
          </Link>
          <Link href="/dashboard" className="text-xs text-text-tertiary hover:text-text-secondary font-mono transition-colors">
            → Dashboard
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Title */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-2xl font-bold text-text-primary">Get set up in 2 minutes</h1>
            <span className="text-xs font-mono px-2.5 py-1 rounded-full border border-coral/30 bg-coral/8 text-coral">
              {completedCount}/4 done
            </span>
          </div>
          <p className="text-text-secondary text-sm leading-relaxed">
            Your API key is ready. Paste the config below into Claude Desktop or Cursor to connect ArbiSim Guard as an MCP tool.
          </p>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 rounded-xl border border-red-800/30 bg-red-950/20 text-sm text-red-400 font-mono">
            {error}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left: config blocks */}
          <div className="space-y-6">
            {/* Claude Desktop */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Claude Desktop</p>
                  <p className="text-xs text-text-tertiary font-mono mt-0.5">
                    ~/Library/Application Support/Claude/claude_desktop_config.json
                  </p>
                </div>
                <CopyButton
                  text={claudeConfig}
                  label="Copy config"
                />
              </div>
              <pre className="px-5 py-4 text-xs font-mono text-text-secondary leading-relaxed overflow-x-auto bg-elevated/50">
                {loading ? (
                  <span className="text-text-tertiary">Loading your API key…</span>
                ) : (
                  claudeConfig
                )}
              </pre>
            </div>

            {/* Cursor */}
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-text-primary">Cursor</p>
                  <p className="text-xs text-text-tertiary font-mono mt-0.5">~/.cursor/mcp.json</p>
                </div>
                <CopyButton
                  text={claudeConfig}
                  label="Copy config"
                />
              </div>
              <pre className="px-5 py-4 text-xs font-mono text-text-secondary leading-relaxed overflow-x-auto bg-elevated/50">
                {loading ? (
                  <span className="text-text-tertiary">Loading your API key…</span>
                ) : (
                  claudeConfig
                )}
              </pre>
            </div>

            {/* Inline copy-all button that marks checklist */}
            <button
              onClick={() => {
                navigator.clipboard.writeText(claudeConfig);
                setConfigCopied(true);
              }}
              className={`w-full py-3 rounded-xl border font-medium text-sm transition-all duration-200 ${
                configCopied
                  ? 'border-teal/30 bg-teal/10 text-teal'
                  : 'border-coral/40 bg-coral/8 text-coral hover:bg-coral/12'
              }`}
            >
              {configCopied ? '✓ Config copied to clipboard' : 'Copy config to clipboard'}
            </button>

            {!isFullKey && apiKey && (
              <p className="text-xs text-amber font-mono px-1">
                ⚠ You have existing keys — visit{' '}
                <Link href="/dashboard/api-keys" className="underline hover:text-amber/80">API Keys</Link>{' '}
                to copy your full key and replace <code>YOUR_API_KEY</code> above.
              </p>
            )}
          </div>

          {/* Right: checklist + next steps */}
          <div className="space-y-6">
            {/* Checklist */}
            <div className="rounded-xl border border-border bg-surface p-5">
              <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-4">Setup checklist</p>
              <div className="space-y-2.5">
                {steps.map((s, i) => (
                  <CheckItem key={i} done={s.done} label={s.label} sub={s.sub} />
                ))}
              </div>
            </div>

            {/* What to do next */}
            <div className="rounded-xl border border-border bg-surface p-5 space-y-3">
              <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest">What happens next</p>
              {[
                { n: '1', text: 'Paste the config into Claude Desktop and restart it.' },
                { n: '2', text: 'Ask Claude: "Simulate this transaction before I send it" — ArbiSim Guard will appear as a tool.' },
                { n: '3', text: 'Each simulation runs against a live fork. Verdict is logged on-chain.' },
              ].map(step => (
                <div key={step.n} className="flex gap-3 items-start">
                  <span className="w-5 h-5 rounded-full bg-coral/10 border border-coral/20 text-coral text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {step.n}
                  </span>
                  <p className="text-sm text-text-secondary leading-relaxed">{step.text}</p>
                </div>
              ))}
            </div>

            {/* Quick links */}
            <div className="flex gap-3">
              <Link
                href="/dashboard/studio"
                className="flex-1 py-2.5 rounded-xl border border-border bg-surface text-center text-sm text-text-secondary hover:text-text-primary hover:bg-elevated transition-all"
              >
                Try Simulation Studio →
              </Link>
              <Link
                href="/dashboard"
                className="flex-1 py-2.5 rounded-xl border border-border bg-surface text-center text-sm text-text-secondary hover:text-text-primary hover:bg-elevated transition-all"
              >
                Go to Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
