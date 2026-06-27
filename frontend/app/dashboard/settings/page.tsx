'use client';

import { useState, useEffect } from 'react';
import { SUPPORTED_NETWORKS } from '../../../lib/chains';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

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

function DangerZone({ apiKey }: { apiKey: string }) {
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeMsg, setRevokeMsg] = useState('');

  async function handleRevokeAll() {
    if (!apiKey) {
      setRevokeMsg('No API key configured - nothing to revoke.');
      return;
    }
    setRevokeLoading(true);
    setRevokeMsg('');
    try {
      const jwt = localStorage.getItem('arbisim_jwt') ?? '';
      const res = await fetch(`${CF_WORKER_URL}/api/v1/keys/revoke-all`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (res.ok) {
        localStorage.removeItem('arbisim_api_key');
        setRevokeMsg('All keys revoked. Reload the page to generate a new one.');
      } else {
        setRevokeMsg('Failed to revoke keys. Try revoking individually from the API Keys page.');
      }
    } catch {
      setRevokeMsg('Network error. Try revoking individually from the API Keys page.');
    } finally {
      setRevokeLoading(false);
      setConfirmRevoke(false);
    }
  }

  return (
    <div className="mt-6 rounded-xl border border-danger/20 bg-danger/5 p-6">
      <h3 className="text-sm font-semibold text-text-primary mb-1">Danger zone</h3>
      <p className="text-xs text-text-secondary mb-4">Irreversible actions. Proceed with care.</p>
      {revokeMsg && (
        <div className="mb-3 px-3 py-2 rounded-lg border border-border bg-surface text-xs text-text-secondary font-mono">
          {revokeMsg}
        </div>
      )}
      <div className="flex items-center justify-between py-3 border-t border-danger/10">
        <div>
          <p className="text-xs font-medium text-text-primary">Revoke all API keys</p>
          <p className="text-xs text-text-tertiary">Immediately invalidates every active key on your account.</p>
        </div>
        {confirmRevoke ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmRevoke(false)}
              className="px-3 py-1.5 text-xs border border-border rounded-lg text-text-secondary hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleRevokeAll}
              disabled={revokeLoading}
              className="px-3 py-1.5 text-xs rounded-lg bg-danger text-white hover:bg-danger/90 transition-colors disabled:opacity-60"
            >
              {revokeLoading ? 'Revoking…' : 'Revoke all'}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmRevoke(true)}
            className="px-3 py-1.5 rounded border border-danger/30 text-danger text-xs font-medium hover:bg-danger/10 transition-colors"
          >
            Revoke all
          </button>
        )}
      </div>
    </div>
  );
}

function SecretReveal({ secret }: { secret: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <div className="rounded-lg border border-teal/30 bg-teal/5 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="w-2 h-2 rounded-full bg-teal animate-pulse" />
        <span className="text-xs font-semibold text-text-primary">Webhook registered</span>
      </div>
      <p className="text-[10px] text-text-tertiary mb-3">Copy your signing secret now - it will not be shown again.</p>
      <div className="flex items-center gap-3 px-3 py-2 rounded border border-border bg-surface font-mono text-xs text-text-primary">
        <span className="flex-1 break-all">{secret}</span>
        <button
          onClick={copy}
          className={`text-[10px] px-2 py-1 border rounded shrink-0 transition-all ${
            copied
              ? 'border-teal/30 bg-teal/10 text-teal'
              : 'border-border bg-elevated text-text-tertiary hover:text-text-primary'
          }`}
        >
          {copied ? '✓' : 'copy'}
        </button>
      </div>
    </div>
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
  const [webhookError, setWebhookError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Load API key and Webhook config on mount
  useEffect(() => {
    const raw = typeof window !== 'undefined' ? (localStorage.getItem('arbisim_api_key') || '') : '';
    const key = raw.trim().replace(/[^\x20-\x7E]/g, '');
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
    setWebhookError('');
    if (!apiKey) {
      setWebhookError('Configure your API key in the API Keys section first.');
      return;
    }
    if (!webhookUrl.trim() || !webhookUrl.startsWith('http')) {
      setWebhookError('Enter a valid HTTP or HTTPS URL.');
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
        const data = await res.json() as { id: string; url: string; secret: string };
        setWebhookId(data.id);
        setWebhookUrl(data.url);
        setJustCreatedSecret(data.secret);
        setWebhookSave('saved');
        setTimeout(() => setWebhookSave('idle'), 2000);
      } else {
        setWebhookSave('idle');
        const err = await res.json().catch(() => ({}) as Record<string, unknown>);
        const errMsg = (err as { error?: { message?: string } })?.error?.message;
        setWebhookError(errMsg ?? 'Failed to save webhook.');
      }
    } catch {
      setWebhookSave('idle');
      setWebhookError('Network error - could not reach the gateway.');
    }
  };

  const handleRemoveWebhook = async () => {
    if (!apiKey || !webhookId) return;
    setDeleteLoading(true);
    setWebhookError('');
    try {
      const res = await fetch(`${CF_WORKER_URL}/api/v1/webhooks/${webhookId}`, {
        method: 'DELETE',
        headers: { 'X-API-Key': apiKey },
      });

      if (res.ok) {
        setWebhookId(null);
        setWebhookUrl('');
        setJustCreatedSecret(null);
        setConfirmDelete(false);
      } else {
        setWebhookError('Failed to remove webhook. Try again.');
      }
    } catch {
      setWebhookError('Network error - could not reach the gateway.');
    } finally {
      setDeleteLoading(false);
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
              description="Your name shown on simulation receipts and API key ownership.">
              <Field label="Name" hint="Optional - shown on your simulation receipts.">
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
                  {Object.values(SUPPORTED_NETWORKS).map(chain => (
                    <option key={chain.id} value={chain.id} disabled={chain.comingSoon}>
                      {chain.displayName}{chain.comingSoon ? ' (coming soon)' : ''}
                    </option>
                  ))}
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
                <SecretReveal secret={justCreatedSecret} />
              )}

              {webhookError && (
                <div className="rounded-lg border border-red-800/30 bg-red-950/20 px-4 py-3 text-xs text-red-400 font-mono">
                  {webhookError}
                </div>
              )}

              <Field label="Webhook URL" hint="ArbiSim Guard will POST simulation results to this endpoint.">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => { setWebhookUrl(e.target.value); setWebhookError(''); }}
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
                  confirmDelete ? (
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-text-tertiary">Remove this webhook?</span>
                      <button
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 border border-border rounded-lg text-xs text-text-secondary hover:text-text-primary transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleRemoveWebhook}
                        disabled={deleteLoading}
                        className="px-3 py-1.5 border border-danger/40 bg-danger/8 text-danger hover:bg-danger/15 rounded-lg text-xs font-medium transition-all disabled:opacity-60"
                      >
                        {deleteLoading ? 'Removing…' : 'Yes, remove'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDelete(true)}
                      className="px-4 py-2 border border-danger/30 bg-danger/5 text-danger hover:bg-danger/10 rounded-lg text-xs font-medium transition-all duration-200 active:scale-[0.98]"
                    >
                      Remove Webhook
                    </button>
                  )
                ) : (
                  <SaveButton state={webhookSave} onClick={handleSaveWebhook} />
                )}
              </div>
            </Section>


          </div>
        </div>

        {/* Danger zone */}
        <DangerZone apiKey={apiKey} />
      </div>
    </div>
  );
}
