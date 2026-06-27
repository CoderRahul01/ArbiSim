'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

function CopyBlock({ label, content }: { label: string; content: string }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="rounded-xl border border-border bg-elevated overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface">
        <span className="text-xs font-medium text-text-secondary font-mono">{label}</span>
        <button
          onClick={copy}
          className={`text-xs px-3 py-1 rounded border font-medium transition-all duration-200 ${
            copied
              ? 'border-teal/30 bg-teal/10 text-teal'
              : 'border-border bg-elevated text-text-tertiary hover:text-text-primary'
          }`}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      <pre className="px-4 py-4 text-xs font-mono text-text-secondary leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
        {content}
      </pre>
    </div>
  );
}

function CheckItem({ done, label, sub }: { done: boolean; label: string; sub?: string }) {
  return (
    <div className="flex items-start gap-3 py-3 border-b border-border last:border-0">
      <div className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
        done ? 'bg-teal/20 border-teal/50' : 'border-border bg-elevated'
      }`}>
        {done && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#2dd4bf" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>
      <div>
        <p className={`text-sm font-medium ${done ? 'text-text-primary' : 'text-text-secondary'}`}>{label}</p>
        {sub && <p className="text-xs text-text-tertiary mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function SetupPage() {
  const { address } = useAccount();
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [hasSimulations, setHasSimulations] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('arbisim_jwt');
    if (!token) return;

    // Fetch API keys - use the first active key
    fetch(`${CF_WORKER_URL}/api/v1/keys`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((keys: Array<{ prefix: string; active: boolean; fullKey?: string }> | null) => {
        if (!keys) return;
        const stored = localStorage.getItem('arbisim_api_key');
        if (stored) {
          setApiKey(stored.trim());
          return;
        }
        // Fall back to first active key prefix
        const first = keys.find(k => k.active);
        if (first) setApiKey(first.prefix + '...');
      })
      .catch(() => {});

    // Check if user has run any simulations
    fetch(`${CF_WORKER_URL}/api/v1/stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: { total?: number } | null) => {
        if (data?.total && data.total > 0) setHasSimulations(true);
      })
      .catch(() => {});
  }, []);

  const hasApiKey = !!apiKey;
  const displayKey = apiKey ?? 'YOUR_API_KEY';

  const sseUrl = `${CF_WORKER_URL}/mcp/sse?api_key=${displayKey}`;

  const claudeConfig = JSON.stringify({
    mcpServers: {
      'arbisim-guard': {
        type: 'sse',
        url: sseUrl,
      },
    },
  }, null, 2);

  const cursorConfig = JSON.stringify({
    mcpServers: {
      'arbisim-guard': {
        type: 'sse',
        url: sseUrl,
      },
    },
  }, null, 2);

  return (
    <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-lg font-semibold text-text-primary mb-1">Setup</h1>
        <p className="text-sm text-text-secondary">Connect ArbiSim Guard to your AI agent in under 5 minutes.</p>
      </div>

      <div className="space-y-6">
        {/* Step 1 - Claude Desktop */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 rounded px-2 py-0.5">Step 1</span>
            <h2 className="text-sm font-semibold text-text-primary">Claude Desktop</h2>
          </div>
          <p className="text-xs text-text-secondary mb-4">
            Open <span className="font-mono text-text-primary">claude_desktop_config.json</span> (
            <span className="font-mono">~/Library/Application Support/Claude/</span> on Mac) and add:
          </p>
          <CopyBlock label="claude_desktop_config.json" content={claudeConfig} />
          {!hasApiKey && (
            <p className="text-xs text-amber mt-3">
              Go to <a href="/dashboard/api-keys" className="underline">API Keys</a> and create a key first - it will appear here automatically.
            </p>
          )}
        </div>

        {/* Step 2 - Cursor */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 rounded px-2 py-0.5">Step 2</span>
            <h2 className="text-sm font-semibold text-text-primary">Cursor</h2>
          </div>
          <p className="text-xs text-text-secondary mb-4">
            Open Cursor settings - MCP - add server manually, or paste into <span className="font-mono text-text-primary">.cursor/mcp.json</span>:
          </p>
          <CopyBlock label=".cursor/mcp.json" content={cursorConfig} />
        </div>

        {/* Step 3 - Verify */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 rounded px-2 py-0.5">Step 3</span>
            <h2 className="text-sm font-semibold text-text-primary">Verify it works</h2>
          </div>
          <p className="text-xs text-text-secondary mb-1">Ask Claude or Cursor:</p>
          <div className="rounded-lg border border-border bg-elevated px-4 py-3 font-mono text-xs text-text-secondary mb-4 italic">
            "Use arbisim-guard to simulate a 0.1 ETH transfer from my wallet to vitalik.eth on Arbitrum One"
          </div>
          <p className="text-xs text-text-secondary">You should see a SAFE or REJECTED verdict with gas estimates and risk flags.</p>
        </div>

        {/* Progress checklist */}
        <div className="rounded-xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold text-text-primary mb-3">Progress</h2>
          <div>
            <CheckItem done={!!address} label="Wallet connected" sub={address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connect your wallet'} />
            <CheckItem done={hasApiKey} label="API key generated" sub={hasApiKey ? 'Key found - pre-filled in configs above' : 'Create a key on the API Keys page'} />
            <CheckItem
              done={configCopied}
              label="Config copied"
              sub={configCopied ? 'Copied - paste into your config file' : 'Click Copy on one of the configs above'}
            />
            <CheckItem done={hasSimulations} label="First simulation run" sub={hasSimulations ? 'You have run at least one simulation' : 'Run a simulation via Claude or the Studio'} />
          </div>
        </div>

        {/* SSE URL direct link */}
        <div className="rounded-xl border border-border bg-elevated p-4">
          <p className="text-xs text-text-secondary mb-2">Your MCP SSE endpoint:</p>
          <p className="font-mono text-xs text-text-primary break-all">{sseUrl}</p>
        </div>
      </div>
    </div>
  );
}
