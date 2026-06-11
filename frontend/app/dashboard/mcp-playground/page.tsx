'use client';

import { useState, useRef, useCallback } from 'react';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

const EXAMPLE_PAYLOAD = JSON.stringify([
  {
    to: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    data: '0x414bf389000000000000000000000000af88d065e77c8cc2239327c5edb3a432268e5831000000000000000000000000082af49447d8a07e3bd95bd0d56f352415231aa1100000000000000000000000000000000000000000000000000000000000001f4000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000ffffffff00000000000000000000000000000000000000000000000000000002540be4000000000000000000000000000000000000000000000000002386f26fc1000000000000000000000000000000000000000000000000000000000000000000000',
    value: '0',
  },
], null, 2);

interface Exchange {
  type: 'request' | 'response';
  method: string;
  data: unknown;
  ts: string;
}

interface SimResult {
  status: string;
  gas_cost_eth?: string;
  net_pnl_usd?: string;
  slippage_detected?: string;
  revert_reason?: string | null;
  flags?: Record<string, boolean>;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: 'text-teal border-teal/30 bg-teal/10',
  REJECTED: 'text-danger border-danger/30 bg-danger/10',
  PENDING:  'text-amber border-amber/30 bg-amber/10',
  ERROR:    'text-text-tertiary border-border bg-elevated',
};

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  const json = JSON.stringify(data, null, 2);
  return (
    <div className="rounded-lg border border-border bg-base overflow-hidden">
      <div className="px-3 py-1.5 border-b border-border bg-elevated flex items-center justify-between">
        <span className="text-xs font-mono text-text-tertiary">{label}</span>
      </div>
      <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
        {json.replace(/"(jsonrpc|method|id|result|error|tools|name|description)":/g, (m) =>
          m.replace(/"[^"]+":/, (k) => `<span class="text-coral">${k}</span>`)
        )}
        {json}
      </pre>
    </div>
  );
}

export default function McpPlaygroundPage() {
  const [apiKey,       setApiKey]       = useState(() => typeof window !== 'undefined' ? localStorage.getItem('arbisim_api_key') ?? '' : '');
  const [network,      setNetwork]      = useState('arbitrum-one');
  const [agentAddress, setAgentAddress] = useState('0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266');
  const [txPayload,    setTxPayload]    = useState(EXAMPLE_PAYLOAD);
  const [slippage,     setSlippage]     = useState('2.0');
  const [activeTab,    setActiveTab]    = useState<'call' | 'list'>('call');
  const [running,      setRunning]      = useState(false);
  const [exchanges,    setExchanges]    = useState<Exchange[]>([]);
  const [simResult,    setSimResult]    = useState<SimResult | null>(null);
  const [error,        setError]        = useState('');
  const [toolsList,    setToolsList]    = useState<Record<string, unknown> | null>(null);
  const callIdRef = useRef(1);

  function addExchange(type: Exchange['type'], method: string, data: unknown) {
    setExchanges(prev => [...prev, { type, method, data, ts: new Date().toISOString() }]);
  }

  async function mcpFetch(method: string, params: unknown): Promise<unknown> {
    const id = callIdRef.current++;
    const body = { jsonrpc: '2.0', id, method, params };
    addExchange('request', method, body);

    const res = await fetch(`${CF_WORKER_URL}/api/v1/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    addExchange('response', method, json);

    if (json.error) throw new Error(json.error.message ?? JSON.stringify(json.error));
    return json.result;
  }

  const listTools = useCallback(async () => {
    if (!apiKey) { setError('Enter your API key first.'); return; }
    setError('');
    try {
      const result = await mcpFetch('tools/list', {});
      setToolsList(result as Record<string, unknown>);
      setActiveTab('list');
    } catch (e: any) {
      setError(e.message);
    }
  }, [apiKey]);

  const callTool = useCallback(async () => {
    if (!apiKey) { setError('Enter your API key.'); return; }
    let txs: unknown[];
    try {
      txs = JSON.parse(txPayload);
      if (!Array.isArray(txs)) throw new Error('Must be an array');
    } catch {
      setError('Transactions payload must be a valid JSON array.');
      return;
    }
    setError('');
    setRunning(true);
    setExchanges([]);
    setSimResult(null);
    setActiveTab('call');

    try {
      const result = await mcpFetch('tools/call', {
        name: 'preflight_simulate',
        arguments: {
          network,
          agent_address: agentAddress,
          transactions: txs,
          max_slippage_tolerance: parseFloat(slippage) || 2.0,
        },
      }) as any;

      const sessionId: string = result?.session_id;
      if (!sessionId) throw new Error('No session_id in response');

      // Poll get_simulation_status until terminal
      let attempts = 0;
      while (attempts < 30) {
        await new Promise(r => setTimeout(r, 3000));
        attempts++;
        const status = await mcpFetch('tools/call', {
          name: 'get_simulation_status',
          arguments: { session_id: sessionId },
        }) as any;

        const st: string = status?.status ?? status?.telemetry?.status;
        if (st === 'APPROVED' || st === 'REJECTED') {
          setSimResult({
            status: st,
            gas_cost_eth:     status?.telemetry?.gas_cost_eth,
            net_pnl_usd:      status?.telemetry?.net_pnl_usd,
            slippage_detected: status?.telemetry?.slippage_detected,
            revert_reason:    status?.telemetry?.revert_reason,
          });
          break;
        }
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setRunning(false);
    }
  }, [apiKey, network, agentAddress, txPayload, slippage]);

  const copyConfig = useCallback(() => {
    const cfg = JSON.stringify({
      mcpServers: {
        'arbisim-guard': {
          command: 'node',
          args: ['./gateway/dist/index.js', '--mcp'],
          env: { ARBI_API_KEY: apiKey || 'ask_free_••••••••' },
        },
      },
    }, null, 2);
    navigator.clipboard.writeText(cfg).catch(() => {});
  }, [apiKey]);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-6 md:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-semibold text-text-primary">MCP Playground</h1>
            <span className="text-xs font-mono text-coral bg-coral/10 border border-coral/20 px-2 py-0.5 rounded">JSON-RPC 2.0</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={listTools}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-elevated transition-all duration-150">
              List tools
            </button>
            <button onClick={copyConfig}
              className="px-3 py-1.5 rounded-lg border border-border text-xs font-mono text-text-secondary hover:text-text-primary hover:bg-elevated transition-all duration-150">
              Copy Claude Desktop config
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-6 md:px-8 py-8 max-w-6xl w-full mx-auto">
        <div className="grid lg:grid-cols-2 gap-6">

          {/* ── Left: Input form ─────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-surface overflow-hidden">
              <div className="px-5 py-3.5 border-b border-border">
                <h2 className="text-xs font-semibold text-text-primary font-mono uppercase tracking-wider">preflight_simulate</h2>
              </div>
              <div className="p-5 space-y-4">
                {/* API Key */}
                <div>
                  <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-1.5">API Key</label>
                  <input type="password" value={apiKey}
                    onChange={e => { setApiKey(e.target.value); if (typeof window !== 'undefined') localStorage.setItem('arbisim_api_key', e.target.value); }}
                    placeholder="ask_free_••••••••"
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors" />
                </div>
                {/* Network */}
                <div>
                  <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-1.5">Network</label>
                  <select value={network} onChange={e => setNetwork(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-elevated text-text-primary text-sm font-mono focus:outline-none focus:border-coral/50 transition-colors">
                    <option value="arbitrum-one">arbitrum-one</option>
                    <option value="arbitrum-sepolia">arbitrum-sepolia</option>
                    <option value="robinhood-chain-testnet">robinhood-chain-testnet</option>
                  </select>
                </div>
                {/* Agent address */}
                <div>
                  <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-1.5">Agent Address</label>
                  <input value={agentAddress} onChange={e => setAgentAddress(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-sm placeholder:text-text-tertiary focus:outline-none focus:border-coral/50 transition-colors" />
                </div>
                {/* Max slippage */}
                <div>
                  <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-1.5">Max slippage (%)</label>
                  <input type="number" value={slippage} onChange={e => setSlippage(e.target.value)} step="0.1" min="0"
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-sm focus:outline-none focus:border-coral/50 transition-colors" />
                </div>
                {/* Transactions */}
                <div>
                  <label className="block text-xs font-mono text-text-tertiary uppercase tracking-wider mb-1.5">Transactions (JSON array)</label>
                  <textarea rows={8} value={txPayload} onChange={e => setTxPayload(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-border bg-elevated text-text-primary font-mono text-xs resize-y focus:outline-none focus:border-coral/50 transition-colors leading-relaxed" />
                </div>

                {error && <p className="text-xs text-danger font-mono">{error}</p>}

                <button onClick={callTool} disabled={running}
                  className="w-full py-3 rounded-lg bg-coral text-white text-sm font-medium hover:bg-coral-hover disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98] shadow-md shadow-coral/25 flex items-center justify-center gap-2">
                  {running ? (
                    <>
                      <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                      </svg>
                      Calling tool…
                    </>
                  ) : 'Call preflight_simulate'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Right: Exchange log + result ─────────────────────────── */}
          <div className="space-y-4">
            {/* Tab bar */}
            <div className="flex border-b border-border">
              {(['call', 'list'] as const).map(t => (
                <button key={t} onClick={() => setActiveTab(t)}
                  className={`px-4 py-2.5 text-xs font-mono font-medium transition-colors border-b-2 -mb-px ${
                    activeTab === t
                      ? 'border-coral text-coral'
                      : 'border-transparent text-text-tertiary hover:text-text-primary'
                  }`}>
                  {t === 'call' ? 'Exchange log' : 'List tools'}
                </button>
              ))}
            </div>

            {activeTab === 'list' && toolsList && (
              <div className="rounded-xl border border-border bg-surface overflow-hidden">
                <div className="px-5 py-3.5 border-b border-border">
                  <p className="text-xs font-mono text-text-tertiary">tools/list response</p>
                </div>
                <div className="p-5">
                  <pre className="text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre-wrap">
                    {JSON.stringify(toolsList, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {activeTab === 'call' && exchanges.length === 0 && !running && (
              <div className="rounded-xl border border-border bg-surface p-8 text-center">
                <div className="w-10 h-10 rounded-xl bg-elevated border border-border flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-text-tertiary">
                    <path d="M2 3h12M2 6h6M2 9h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                    <circle cx="11.5" cy="10.5" r="3" stroke="currentColor" strokeWidth="1.5"/>
                    <path d="M14 13l1.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="text-xs font-medium text-text-primary mb-1">No exchanges yet</p>
                <p className="text-xs text-text-tertiary">Click "Call preflight_simulate" to see the raw JSON-RPC messages.</p>
              </div>
            )}

            {activeTab === 'call' && exchanges.length > 0 && (
              <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                {exchanges.map((ex, i) => (
                  <div key={i} className="rounded-xl border border-border bg-surface overflow-hidden">
                    <div className={`px-4 py-2 border-b border-border flex items-center gap-2 ${
                      ex.type === 'request' ? 'bg-coral/5' : 'bg-teal/5'
                    }`}>
                      <span className={`text-xs font-mono font-semibold ${ex.type === 'request' ? 'text-coral' : 'text-teal'}`}>
                        {ex.type === 'request' ? '→ REQUEST' : '← RESPONSE'}
                      </span>
                      <span className="text-xs font-mono text-text-tertiary">{ex.method}</span>
                      <span className="ml-auto text-xs text-text-tertiary font-mono">{new Date(ex.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="p-4 text-xs font-mono text-text-secondary overflow-x-auto leading-relaxed whitespace-pre-wrap break-all">
                      {JSON.stringify(ex.data, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}

            {/* Simulation result card */}
            {simResult && (
              <div className={`rounded-xl border p-5 ${simResult.status === 'APPROVED' ? 'border-teal/30 bg-teal/5' : 'border-danger/30 bg-danger/5'}`}>
                <div className="flex items-center gap-2 mb-4">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold font-mono ${STATUS_COLORS[simResult.status] ?? STATUS_COLORS.ERROR}`}>
                    {simResult.status === 'APPROVED' ? '✓' : '✕'} {simResult.status}
                  </span>
                  <span className="text-xs text-text-tertiary">Simulation complete</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: 'Gas cost', value: simResult.gas_cost_eth ? `${simResult.gas_cost_eth} ETH` : '—' },
                    { label: 'Net P&L',  value: simResult.net_pnl_usd ? `$${simResult.net_pnl_usd}` : '—' },
                    { label: 'Slippage', value: simResult.slippage_detected ?? '—' },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-lg bg-surface border border-border">
                      <p className="text-xs text-text-tertiary mb-1 font-mono">{m.label}</p>
                      <p className="text-sm font-semibold font-mono text-text-primary">{m.value}</p>
                    </div>
                  ))}
                </div>
                {simResult.revert_reason && (
                  <div className="mt-3 px-3 py-2 rounded-lg bg-danger/5 border border-danger/20">
                    <p className="text-xs font-mono text-danger">{simResult.revert_reason}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* How-to callout */}
        <div className="mt-6 rounded-xl border border-border bg-surface p-5">
          <h3 className="text-xs font-semibold text-text-primary mb-3 font-mono uppercase tracking-wider">Use from your agent</h3>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-text-tertiary mb-2 font-mono">Claude Desktop / Cursor config</p>
              <pre className="text-xs font-mono text-text-secondary bg-elevated border border-border rounded-lg p-3 overflow-x-auto">{`{
  "mcpServers": {
    "arbisim-guard": {
      "command": "node",
      "args": ["./gateway/dist/index.js", "--mcp"],
      "env": { "ARBI_API_KEY": "${apiKey || 'ask_free_••••••••'}" }
    }
  }
}`}</pre>
            </div>
            <div>
              <p className="text-xs text-text-tertiary mb-2 font-mono">HTTP (this playground endpoint)</p>
              <pre className="text-xs font-mono text-text-secondary bg-elevated border border-border rounded-lg p-3 overflow-x-auto">{`POST ${CF_WORKER_URL}/api/v1/mcp
X-API-Key: ${apiKey || 'ask_free_••••••••'}

{
  "jsonrpc": "2.0", "id": 1,
  "method": "tools/call",
  "params": {
    "name": "preflight_simulate",
    "arguments": { ... }
  }
}`}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
