'use client';

import { useState, useEffect, useCallback } from 'react';

// Admin ops go directly to the gateway (bypasses CF edge auth)
const GATEWAY_URL  = process.env.NEXT_PUBLIC_GATEWAY_URL  ?? 'http://localhost:3001';
const ADMIN_KEY    = process.env.NEXT_PUBLIC_ADMIN_KEY    ?? '';

interface ApiKey {
  id: string;
  prefix: string;
  tier: 'free' | 'pro' | 'enterprise';
  monthlyLimit: number;
  minuteLimit: number;
  createdAt: string;
  lastUsed?: string;
  active: boolean;
  fullKey?: string;
}

const TIER_COLORS: Record<string, string> = {
  free:       'text-text-secondary bg-elevated border-border',
  pro:        'text-coral bg-coral/10 border-coral/25',
  enterprise: 'text-amber bg-amber/10 border-amber/25',
};

const TIER_LIMITS: Record<string, { monthly: number; perMinute: number }> = {
  free:       { monthly: 500,    perMinute: 10  },
  pro:        { monthly: 10000,  perMinute: 60  },
  enterprise: { monthly: 100000, perMinute: 300 },
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <button onClick={copy}
      className={`text-xs px-2.5 py-1 rounded border font-mono transition-all duration-200 ${
        copied
          ? 'border-teal/30 bg-teal/10 text-teal'
          : 'border-border bg-elevated text-text-tertiary hover:text-text-primary hover:border-border/80'
      }`}>
      {copied ? '✓ copied' : 'copy'}
    </button>
  );
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [creating, setCreating] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newKeyTier, setNewKeyTier] = useState<'free' | 'pro' | 'enterprise'>('free');
  const [newKeyName, setNewKeyName] = useState('');
  const [justCreated, setJustCreated] = useState<ApiKey | null>(null);
  const [error, setError] = useState('');

  // Load persisted keys from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('arbisim_demo_keys');
      if (stored) setKeys(JSON.parse(stored));
    } catch {}
  }, []);

  function persist(updated: ApiKey[]) {
    setKeys(updated);
    try { localStorage.setItem('arbisim_demo_keys', JSON.stringify(updated)); } catch {}
  }

  const createKey = useCallback(async () => {
    if (!newKeyName.trim()) { setError('Enter a name for the key.'); return; }
    setError('');
    setCreating(true);

    try {
      let fullKey: string;
      let record: Omit<ApiKey, 'id' | 'fullKey'>;

      if (ADMIN_KEY) {
        // Real backend call — goes directly to gateway (bypasses CF edge auth)
        const res = await fetch(`${GATEWAY_URL}/admin/api-keys`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': ADMIN_KEY },
          body: JSON.stringify({ tier: newKeyTier, owner_email: newKeyName }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
          throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
        }
        const data = await res.json() as {
          key: string;
          prefix: string;
          tier: string;
          id: string;
          created_at: string;
          cf_kv: { hash: string; value: string; command: string };
        };
        fullKey = data.key;
        record = {
          prefix: data.prefix + '.••••••••',
          tier: newKeyTier,
          monthlyLimit: TIER_LIMITS[newKeyTier].monthly,
          minuteLimit:  TIER_LIMITS[newKeyTier].perMinute,
          createdAt:    data.created_at,
          active:       true,
        };
      } else {
        // Demo mode — client-side key for UI demonstration only
        const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        fullKey = `ask_${newKeyTier}_${rand.slice(0, 8)}.${rand.slice(8)}`;
        record = {
          prefix: `ask_${newKeyTier}_${rand.slice(0, 8)}.••••••••`,
          tier: newKeyTier,
          monthlyLimit: TIER_LIMITS[newKeyTier].monthly,
          minuteLimit:  TIER_LIMITS[newKeyTier].perMinute,
          createdAt:    new Date().toISOString(),
          active:       true,
        };
      }

      const newKey: ApiKey = { id: crypto.randomUUID(), ...record, fullKey };
      setJustCreated(newKey);
      persist([newKey, ...keys]);
      // Store as the active key so the simulate page and stats hook pick it up
      try { localStorage.setItem('arbisim_api_key', fullKey); } catch {}
      setShowModal(false);
      setNewKeyName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create key.');
    } finally {
      setCreating(false);
    }
  }, [newKeyName, newKeyTier, keys]);

  function revokeKey(id: string) {
    if (!confirm('Revoke this key? This cannot be undone.')) return;
    persist(keys.map(k => k.id === id ? { ...k, active: false } : k));
  }

  function deleteKey(id: string) {
    persist(keys.filter(k => k.id !== id));
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center justify-between">
          <h1 className="text-sm font-semibold text-text-primary">API Keys</h1>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-coral text-white text-xs font-medium rounded-lg hover:bg-coral-hover transition-all duration-200 active:scale-95 shadow-md shadow-coral/25">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round"/>
            </svg>
            Create key
          </button>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-4xl w-full mx-auto space-y-6">

        {/* Just-created banner */}
        {justCreated && (
          <div className="rounded-xl border border-teal/30 bg-teal/5 p-5 animate-slide-up">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2 h-2 rounded-full bg-teal" />
                  <span className="text-sm font-semibold text-text-primary">Key created — copy it now</span>
                </div>
                <p className="text-xs text-text-tertiary">This is the only time the full key is shown. Store it securely.</p>
              </div>
              <button onClick={() => setJustCreated(null)} className="text-text-tertiary hover:text-text-primary transition-colors text-lg leading-none mt-0.5">×</button>
            </div>
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-surface border border-border font-mono text-sm">
              <span className="flex-1 text-text-primary break-all">{justCreated.fullKey}</span>
              <CopyButton text={justCreated.fullKey ?? ''} />
            </div>
            {!ADMIN_KEY && (
              <div className="mt-3 px-4 py-2.5 rounded-lg bg-amber/5 border border-amber/20">
                <p className="text-xs text-amber-300">
                  <span className="font-semibold">Demo mode:</span> This key was generated locally and must be seeded into Cloudflare KV before it authenticates API calls.
                  Deploy the backend and run: <code className="font-mono ml-1 text-amber">wrangler kv key put --namespace-id YOUR_ID &quot;sha256({justCreated.fullKey?.slice(0,12)}...)&quot; &#39;{'{'}&quot;tier&quot;:&quot;{justCreated.tier}&quot;,...{'}'}&#39;</code>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Info banner if no admin key */}
        {!ADMIN_KEY && keys.length === 0 && (
          <div className="rounded-xl border border-amber/20 bg-amber/5 p-5">
            <div className="flex gap-3">
              <span className="text-amber text-lg shrink-0">ℹ</span>
              <div>
                <p className="text-sm font-medium text-text-primary mb-1">Demo mode active</p>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Keys created here are UI demonstrations. To create real authenticated keys, deploy the gateway and set
                  <code className="font-mono text-amber mx-1 text-xs">NEXT_PUBLIC_ADMIN_KEY</code> in your Vercel environment variables.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Keys table */}
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-text-primary">Your keys</h2>
            <span className="text-xs font-mono text-text-tertiary">{keys.filter(k => k.active).length} active</span>
          </div>

          {keys.length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="w-12 h-12 rounded-xl bg-elevated border border-border flex items-center justify-center mx-auto mb-4">
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-text-tertiary">
                  <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                  <path d="M8.5 8.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-sm font-medium text-text-primary mb-2">No API keys yet</p>
              <p className="text-xs text-text-tertiary mb-5 max-w-xs mx-auto">Create a key to authenticate API calls and start running simulations from your agent or CLI.</p>
              <button onClick={() => setShowModal(true)}
                className="px-4 py-2 bg-coral text-white text-xs font-medium rounded-lg hover:bg-coral-hover transition-colors shadow-md shadow-coral/20">
                Create your first key
              </button>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {/* Table header */}
              <div className="hidden md:grid grid-cols-[1fr_80px_90px_120px_100px] gap-4 px-6 py-2.5 bg-elevated">
                {['Key', 'Tier', 'Limits', 'Created', 'Actions'].map(h => (
                  <span key={h} className="text-xs font-mono text-text-tertiary uppercase tracking-wider">{h}</span>
                ))}
              </div>
              {keys.map(key => (
                <div key={key.id} className={`grid md:grid-cols-[1fr_80px_90px_120px_100px] gap-4 items-center px-6 py-4 ${!key.active ? 'opacity-50' : ''}`}>
                  {/* Key prefix */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-md bg-elevated border border-border flex items-center justify-center shrink-0">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-text-tertiary">
                        <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
                        <path d="M8.5 8.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <code className="text-sm font-mono text-text-primary">{key.prefix}</code>
                      {!key.active && <span className="ml-2 text-xs text-danger font-medium">revoked</span>}
                    </div>
                  </div>
                  {/* Tier */}
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-mono font-medium w-fit ${TIER_COLORS[key.tier]}`}>
                    {key.tier}
                  </span>
                  {/* Limits */}
                  <div className="text-xs text-text-tertiary font-mono">
                    <p>{key.monthlyLimit.toLocaleString()}/mo</p>
                    <p>{key.minuteLimit}/min</p>
                  </div>
                  {/* Created */}
                  <p className="text-xs text-text-tertiary font-mono">
                    {new Date(key.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {key.active ? (
                      <button onClick={() => revokeKey(key.id)}
                        className="text-xs text-text-tertiary hover:text-danger transition-colors font-mono border border-transparent hover:border-danger/30 px-2 py-1 rounded">
                        revoke
                      </button>
                    ) : (
                      <button onClick={() => deleteKey(key.id)}
                        className="text-xs text-text-tertiary hover:text-danger transition-colors font-mono border border-transparent hover:border-danger/30 px-2 py-1 rounded">
                        delete
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Usage note */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h3 className="text-sm font-semibold text-text-primary mb-3">How to use</h3>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-text-tertiary mb-2 font-mono uppercase tracking-wider">REST API</p>
              <pre className="text-xs font-mono text-text-secondary bg-elevated border border-border rounded-lg p-3 overflow-x-auto">
{`curl -X POST https://arbisim-proxy.workers.dev/api/v1/simulate \\
  -H "X-API-Key: ask_free_••••••••" \\
  -H "Content-Type: application/json" \\
  -d '{"network":"arbitrum-one","agent_address":"0x...","transactions":[...],"max_slippage_tolerance":2.0}'`}
              </pre>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-2 font-mono uppercase tracking-wider">MCP (Vibekit / Eliza / LangGraph)</p>
              <pre className="text-xs font-mono text-text-secondary bg-elevated border border-border rounded-lg p-3 overflow-x-auto">
{`// In your agent config
{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["./gateway/dist/index.js", "--mcp"],
      "env": { "GATEWAY_API_KEY": "ask_free_••••••••" }
    }
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Create key modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="fixed inset-0 bg-base/80 backdrop-blur-sm" />
          <div className="glass relative w-full max-w-md rounded-2xl p-6 shadow-2xl animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-semibold text-text-primary">Create API key</h2>
              <button onClick={() => setShowModal(false)} className="text-text-tertiary hover:text-text-primary transition-colors text-xl leading-none">×</button>
            </div>

            <div className="space-y-5">
              <div>
                <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Key name / owner ID</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={e => { setNewKeyName(e.target.value); setError(''); }}
                  placeholder="my-vibekit-agent"
                  className="w-full px-4 py-3 rounded-lg border border-border bg-elevated text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">Tier</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['free', 'pro', 'enterprise'] as const).map(tier => (
                    <button key={tier} onClick={() => setNewKeyTier(tier)}
                      className={`py-2.5 rounded-lg border text-xs font-mono font-medium transition-all duration-150 capitalize ${
                        newKeyTier === tier
                          ? 'border-coral/40 bg-coral/10 text-coral'
                          : 'border-border bg-elevated text-text-secondary hover:text-text-primary hover:border-border/80'
                      }`}>
                      {tier}
                    </button>
                  ))}
                </div>
                <div className="mt-2 px-3 py-2 rounded-md bg-elevated border border-border">
                  <p className="text-xs text-text-secondary font-mono">
                    {TIER_LIMITS[newKeyTier].monthly.toLocaleString()} sims/month · {TIER_LIMITS[newKeyTier].perMinute}/min
                  </p>
                </div>
              </div>

              {error && (
                <p className="text-xs text-danger font-mono">{error}</p>
              )}

              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-border text-text-secondary text-sm font-medium hover:text-text-primary hover:bg-elevated transition-all duration-150">
                  Cancel
                </button>
                <button onClick={createKey} disabled={creating}
                  className="flex-1 py-2.5 rounded-lg bg-coral text-white text-sm font-medium hover:bg-coral-hover disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] shadow-md shadow-coral/25 flex items-center justify-center gap-2">
                  {creating ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Creating...
                    </>
                  ) : 'Create key'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
