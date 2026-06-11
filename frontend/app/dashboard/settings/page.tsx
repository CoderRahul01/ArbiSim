'use client';

import { useState, useEffect } from 'react';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

type SaveState = 'idle' | 'saving' | 'saved';

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-6 py-8 border-b border-border last:border-0">
      <div>
        <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
        <p className="text-xs text-text-secondary leading-relaxed">{description}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

interface FieldProps {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div>
      <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-2">{label}</label>
      {children}
      {hint && <p className="text-xs text-text-tertiary mt-1.5">{hint}</p>}
    </div>
  );
}

function SaveButton({ state, onClick, disabled }: { state: SaveState; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={state === 'saving' || disabled}
      className={`px-4 py-2 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed ${
        state === 'saved'
          ? 'border border-teal/30 bg-teal/10 text-teal'
          : 'border border-border bg-elevated text-text-primary hover:bg-surface hover:border-border/80'
      }`}>
      {state === 'saving' ? 'Saving…' : state === 'saved' ? '✓ Saved' : 'Save changes'}
    </button>
  );
}

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [defaultNetwork, setDefaultNetwork] = useState('arbitrum-one');
  const [defaultSlippage, setDefaultSlippage] = useState('2.0');
  
  // Webhook State
  const [webhookId, setWebhookId] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [justCreatedSecret, setJustCreatedSecret] = useState<string | null>(null);

  const [profileSave, setProfileSave] = useState<SaveState>('idle');
  const [prefSave, setPrefSave] = useState<SaveState>('idle');
  const [webhookSave, setWebhookSave] = useState<SaveState>('idle');

  // Load API key and Webhook config on mount
  useEffect(() => {
    const key = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
    setApiKey(key);
    
    // Load local storage preferences if any
    try {
      const storedName = localStorage.getItem('arbisim_display_name');
      if (storedName) setDisplayName(storedName);
      
      const storedNetwork = localStorage.getItem('arbisim_default_network');
      if (storedNetwork) setDefaultNetwork(storedNetwork);
      
      const storedSlippage = localStorage.getItem('arbisim_default_slippage');
      if (storedSlippage) setDefaultSlippage(storedSlippage);
    } catch {}

    if (!key) return;

    fetch(`${CF_WORKER_URL}/api/v1/webhooks`, {
      headers: { 'X-API-Key': key },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.webhooks && data.webhooks.length > 0) {
          const activeHook = data.webhooks[0];
          setWebhookId(activeHook.id);
          setWebhookUrl(activeHook.url);
        }
      })
      .catch(() => {});
  }, []);

  function handleSaveProfile() {
    setProfileSave('saving');
    try {
      localStorage.setItem('arbisim_display_name', displayName);
      setTimeout(() => {
        setProfileSave('saved');
        setTimeout(() => setProfileSave('idle'), 2000);
      }, 500);
    } catch {
      setProfileSave('idle');
    }
  }

  function handleSavePrefs() {
    setPrefSave('saving');
    try {
      localStorage.setItem('arbisim_default_network', defaultNetwork);
      localStorage.setItem('arbisim_default_slippage', defaultSlippage);
      setTimeout(() => {
        setPrefSave('saved');
        setTimeout(() => setPrefSave('idle'), 2000);
      }, 500);
    } catch {
      setPrefSave('idle');
    }
  }

  const handleSaveWebhook = async () => {
    if (!apiKey) {
      alert('Configure your API key in the API Keys section first.');
      return;
    }
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
      alert('Please enter a valid HTTP or HTTPS URL.');
      return;
    }

    setWebhookSave('saving');
    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/webhooks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': apiKey,
        },
        body: JSON.stringify({ url: webhookUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        setWebhookId(data.id);
        setWebhookUrl(data.url);
        setJustCreatedSecret(data.secret);
        setWebhookSave('saved');
        setTimeout(() => setWebhookSave('idle'), 2000);
      } else {
        setWebhookSave('idle');
        const err = await res.json().catch(() => ({}));
        alert(err?.error?.message ?? 'Failed to save webhook.');
      }
    } catch (err) {
      setWebhookSave('idle');
      alert('Failed to save webhook.');
    }
  };

  const handleRemoveWebhook = async () => {
    if (!apiKey || !webhookId) return;
    if (!confirm('Are you sure you want to deactivate and remove this webhook endpoint?')) return;

    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey },
      });

      if (res.ok) {
        setWebhookId(null);
        setWebhookUrl('');
        setJustCreatedSecret(null);
        alert('Webhook removed successfully.');
      } else {
        alert('Failed to remove webhook.');
      }
    } catch (err) {
      alert('Failed to remove webhook.');
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center">
          <h1 className="text-sm font-semibold text-text-primary">Settings</h1>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-4xl w-full mx-auto">
        <div className="rounded-xl border border-border bg-surface divide-y divide-border">
          <div className="px-6 py-5">
            <h2 className="text-sm font-semibold text-text-primary">Account settings</h2>
            <p className="text-xs text-text-tertiary mt-0.5">Configure your ArbiSim Guard account preferences.</p>
          </div>

          <div className="px-6">

            {/* Profile */}
            <Section
              title="Profile"
              description="Your display name used for key ownership attribution and support tickets.">
              <Field label="Display name" hint="Used as the ownerId when creating keys from the dashboard.">
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="e.g. Vibekit Agent"
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-elevated text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors"
                />
              </Field>
              <div className="flex justify-end">
                <SaveButton state={profileSave} onClick={handleSaveProfile} />
              </div>
            </Section>

            {/* Simulation defaults */}
            <Section
              title="Simulation defaults"
              description="Default values pre-filled in the Live Simulation playground. Override per request.">
              <Field label="Default network">
                <select
                  value={defaultNetwork}
                  onChange={e => setDefaultNetwork(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-elevated text-text-primary text-sm focus:outline-none focus:border-coral/50 transition-colors appearance-none">
                  <option value="arbitrum-one">Arbitrum One (mainnet)</option>
                  <option value="arbitrum-sepolia">Arbitrum Sepolia (testnet)</option>
                  <option value="robinhood-chain-testnet">Robinhood Chain Testnet</option>
                </select>
              </Field>
              <Field label="Max slippage tolerance (%)" hint="Simulations with slippage above this threshold will set high_slippage: true.">
                <input
                  type="number"
                  min="0.1"
                  max="50"
                  step="0.1"
                  value={defaultSlippage}
                  onChange={e => setDefaultSlippage(e.target.value)}
                  className="w-full md:w-40 px-4 py-2.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-sm focus:outline-none focus:border-coral/50 transition-colors"
                />
              </Field>
              <div className="flex justify-end">
                <SaveButton state={prefSave} onClick={handleSavePrefs} />
              </div>
            </Section>

            {/* Webhook config */}
            <Section
              title="Webhook endpoint"
              description="Receive simulation results as webhook events instead of polling. HMAC-SHA256 signed with your secret.">
              
              {justCreatedSecret && (
                <div className="rounded-lg border border-teal/30 bg-teal/5 p-4 mb-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
                    <span className="text-xs font-semibold text-text-primary">Webhook registered successfully</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary mb-3">Copy your signing secret. It will not be shown again.</p>
                  <div className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-surface font-mono text-xs text-text-primary">
                    <span className="flex-1 break-all">{justCreatedSecret}</span>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(justCreatedSecret);
                        alert('Secret copied to clipboard');
                      }}
                      className="text-[10px] px-2 py-1 border border-border bg-elevated text-text-tertiary rounded hover:text-text-primary transition-colors"
                    >
                      copy
                    </button>
                  </div>
                </div>
              )}

              <Field label="Webhook URL" hint="ArbiSim Guard will POST simulation results to this endpoint.">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://your-agent.example.com/hooks/arbisim"
                  disabled={webhookId !== null}
                  className={`w-full px-4 py-2.5 rounded-lg border border-border bg-elevated text-text-primary text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors ${
                    webhookId !== null ? 'opacity-70 cursor-not-allowed bg-surface' : ''
                  }`}
                />
              </Field>
              
              <Field label="Signing secret" hint="Used to verify the X-ArbiSim-Signature header on incoming payloads.">
                <input
                  type="password"
                  value={webhookId !== null ? '••••••••••••••••••••••••••••••••' : ''}
                  placeholder="whsec_••••••••"
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-sm placeholder:text-text-tertiary opacity-70 cursor-not-allowed bg-surface"
                />
              </Field>

              <div className="flex justify-end gap-3">
                {webhookId !== null ? (
                  <button
                    onClick={handleRemoveWebhook}
                    className="px-4 py-2 border border-danger/30 bg-danger/5 text-danger hover:bg-danger/10 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98]"
                  >
                    Remove Webhook
                  </button>
                ) : (
                  <SaveButton state={webhookSave} onClick={handleSaveWebhook} />
                )}
              </div>
            </Section>

            {/* Gateway endpoint */}
            <Section
              title="Gateway endpoint"
              description="The backend API your dashboard is pointing at. Change this if you self-host the gateway.">
              <Field label="Current endpoint">
                <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg border border-border bg-elevated">
                  <span className="flex-1 font-mono text-sm text-text-secondary truncate">{CF_WORKER_URL}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                    <span className="text-xs text-teal font-mono">connected</span>
                  </div>
                </div>
              </Field>
              <p className="text-xs text-text-tertiary">
                Set via <code className="font-mono text-coral">NEXT_PUBLIC_CF_WORKER_URL</code> in your Vercel environment variables.
              </p>
            </Section>

          </div>
        </div>

        {/* Danger zone */}
        <div className="mt-6 rounded-xl border border-danger/20 bg-danger/5 p-6">
          <h3 className="text-sm font-semibold text-text-primary mb-1">Danger zone</h3>
          <p className="text-xs text-text-secondary mb-4">Irreversible actions. Proceed with care.</p>
          <div className="flex items-center justify-between py-3 border-t border-danger/10">
            <div>
              <p className="text-xs font-medium text-text-primary">Revoke all API keys</p>
              <p className="text-xs text-text-tertiary">Immediately invalidates every active key on your account.</p>
            </div>
            <button className="px-3 py-1.5 rounded border border-danger/30 text-danger text-xs font-medium hover:bg-danger/10 transition-colors">
              Revoke all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
