'use client';

import { useState } from 'react';

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

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={state === 'saving'}
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
  const [displayName, setDisplayName] = useState('');
  const [defaultNetwork, setDefaultNetwork] = useState('arbitrum-one');
  const [defaultSlippage, setDefaultSlippage] = useState('2.0');
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [profileSave, setProfileSave] = useState<SaveState>('idle');
  const [prefSave, setPrefSave] = useState<SaveState>('idle');
  const [webhookSave, setWebhookSave] = useState<SaveState>('idle');

  function fakeSave(setter: (s: SaveState) => void) {
    setter('saving');
    setTimeout(() => {
      setter('saved');
      setTimeout(() => setter('idle'), 2000);
    }, 700);
  }

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
                <SaveButton state={profileSave} onClick={() => fakeSave(setProfileSave)} />
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
                <SaveButton state={prefSave} onClick={() => fakeSave(setPrefSave)} />
              </div>
            </Section>

            {/* Webhook config */}
            <Section
              title="Webhook endpoint"
              description="Receive simulation results as webhook events instead of polling. HMAC-SHA256 signed with your secret.">
              <div className="px-4 py-3 rounded-lg bg-amber/5 border border-amber/20 mb-2">
                <p className="text-xs text-amber-300">
                  <span className="font-semibold">Coming soon — Pro plan.</span> Webhooks eliminate polling and are the recommended integration pattern for production agents.
                </p>
              </div>
              <Field label="Webhook URL" hint="ArbiSim Guard will POST simulation results to this endpoint.">
                <input
                  type="url"
                  value={webhookUrl}
                  onChange={e => setWebhookUrl(e.target.value)}
                  placeholder="https://your-agent.example.com/hooks/arbisim"
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-elevated text-text-primary text-sm placeholder:text-text-tertiary opacity-50 cursor-not-allowed"
                />
              </Field>
              <Field label="Signing secret" hint="Used to verify the X-ArbiSim-Signature header on incoming payloads.">
                <input
                  type="password"
                  value={webhookSecret}
                  onChange={e => setWebhookSecret(e.target.value)}
                  placeholder="whsec_••••••••"
                  disabled
                  className="w-full px-4 py-2.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-sm placeholder:text-text-tertiary opacity-50 cursor-not-allowed"
                />
              </Field>
              <div className="flex justify-end">
                <SaveButton state={webhookSave} onClick={() => fakeSave(setWebhookSave)} />
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
