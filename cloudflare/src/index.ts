export interface Env {
  API_KEYS: KVNamespace;
  GATEWAY_URL: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  ADMIN_API_KEY: string;
  JWT_SECRET: string;
  RENDER_WORKER_URL: string;
}

import jwt from '@tsndr/cloudflare-worker-jwt';
import { verifyMessage } from 'viem';

interface ApiKeyRecord {
  tier: 'free' | 'builder' | 'protocol' | 'admin';
  monthlyLimit: number;
  minuteLimit: number;
  ownerId: string;
  active: boolean;
}

const TIER_LIMITS: Record<ApiKeyRecord['tier'], { perMinute: number }> = {
  free:     { perMinute: 10   },
  builder:  { perMinute: 60   },
  protocol: { perMinute: 300  },
  admin:    { perMinute: 1000 },
};

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-API-Key, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function jsonError(status: number, code: string, message: string, origin: string | null): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env): Promise<void> {
    const base = (env.RENDER_WORKER_URL || '').replace(/\/$/, '');
    if (base) {
      await fetch(`${base}/ping`, { method: 'GET' }).catch(() => {});
    }
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('Origin');

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', ts: Date.now() }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // ── Public no-auth demo endpoint — returns a realistic simulation result ──
    // Anyone can hit this to see what ArbiSim returns. No API key required.
    // Used by: docs quickstart, Ava Labs BD demos, Discord showcases.
    if (url.pathname === '/api/v1/demo' && request.method === 'POST') {
      let body: Record<string, unknown> = {};
      try { body = await request.json() as Record<string, unknown>; } catch { /* no body is fine */ }

      const network = (body.network as string) ?? 'avalanche-fuji';
      const _slippage = Number(body.max_slippage_tolerance ?? 2.0);

      // Deterministic scenario: if network contains 'arbitrum' simulate a sandwich / rejected case.
      // Everything else gets an APPROVED response so callers can see both outcomes.
      const isArbitrum = network.toLowerCase().includes('arbitrum');
      const jobId = crypto.randomUUID();
      const latencyMs = 180 + Math.floor(Math.random() * 220); // 180–400ms realistic range

      const approvedResult = {
        job_id: jobId,
        status: 'APPROVED',
        network,
        simulated_at_block: isArbitrum ? 328_419_200 : 48_211_044,
        latency_ms: latencyMs,
        checks: {
          would_revert: false,
          price_impact_too_high: false,
          frontrun_detected: false,
          risky_allowance: false,
          signature_invalid: false,
          permission_expired: false,
          use_priority_lane: false,
          compute_limit_exceeded: false,
          untrusted_counterparty: false,
          payment_unverified: false,
        },
        gas: {
          l2_gas_used: 183_420,
          total_wei: '210000000000000',
          fee_avax: '0.00021',
        },
        verdict: 'APPROVED — safe to broadcast',
        _note: 'This is a public demo response. Plug in a real API key at /dashboard to run live simulations.',
      };

      const rejectedResult = {
        job_id: jobId,
        status: 'REJECTED',
        network,
        simulated_at_block: 328_419_200,
        latency_ms: latencyMs,
        checks: {
          would_revert: false,
          price_impact_too_high: true,   // 11.3% detected — exceeds 2% threshold
          frontrun_detected: true,        // sandwich attack in same block
          risky_allowance: false,
          signature_invalid: false,
          permission_expired: false,
          use_priority_lane: true,        // Timeboost would help here
          compute_limit_exceeded: false,
          untrusted_counterparty: false,
          payment_unverified: false,
        },
        gas: {
          l2_gas_used: 201_840,
          total_wei: '231000000000000',
          fee_eth: '0.000231',
        },
        reasons: [
          'Price impact is 11.3% — your limit is 2.0%. You would receive far fewer tokens than quoted.',
          'A sandwich bot has positioned two transactions around yours in the same block.',
          'Using Timeboost priority lane would give your transaction a 200ms speed advantage.',
        ],
        verdict: 'REJECTED — abort to protect funds',
        _note: 'This is a public demo response showing a REJECTED case. Plug in a real API key at /dashboard to simulate your own transactions.',
      };

      const result = isArbitrum ? rejectedResult : approvedResult;

      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // ── Sandbox: GET /api/v1/demo returns a curl example + both scenarios ────
    if (url.pathname === '/api/v1/demo' && request.method === 'GET') {
      const example = {
        message: 'ArbiSim Guard — public demo endpoint. No API key required.',
        usage: {
          approved_example: 'POST /api/v1/demo   {"network":"avalanche-fuji","agent_address":"0x...","transactions":[...]}',
          rejected_example: 'POST /api/v1/demo   {"network":"arbitrum-one","agent_address":"0x...","transactions":[...]}',
        },
        tip: 'Pass network=avalanche-fuji for an APPROVED result. Pass network=arbitrum-one for a REJECTED result with MEV detection.',
        real_api: 'https://arbisimguard.vercel.app/dashboard — create a free key and run live simulations against mainnet.',
        docs: 'https://arbisimguard.vercel.app/docs',
      };
      return new Response(JSON.stringify(example, null, 2), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    // ── Public simulation permalink — no auth required ─────────────────────
    if (url.pathname.startsWith('/api/v1/sim/public/')) {
      const targetUrl = env.GATEWAY_URL.replace(/\/$/, '') + url.pathname + url.search;
      const proxyReq = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
      });
      try {
        const resp = await fetch(proxyReq);
        const body = await resp.arrayBuffer();
        return new Response(body, {
          status: resp.status,
          headers: {
            'Content-Type': resp.headers.get('Content-Type') ?? 'application/json',
            ...corsHeaders(origin),
          },
        });
      } catch {
        return jsonError(502, 'GATEWAY_ERROR', 'Simulation engine unreachable.', origin);
      }
    }

    // ── Auth Routes (SIWE) ─────────────────────────────────────────────────
    if (url.pathname === '/api/v1/auth/nonce' && request.method === 'GET') {
      const nonce = crypto.randomUUID().replace(/-/g, '');
      await env.API_KEYS.put(`nonce:${nonce}`, '1', { expirationTtl: 300 });
      return new Response(JSON.stringify({ nonce }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (url.pathname === '/api/v1/auth/verify' && request.method === 'POST') {
      try {
        const { message, signature, address } = await request.json() as any;
        const nonceMatch = message.match(/Nonce: ([a-zA-Z0-9]+)/);
        if (!nonceMatch) return jsonError(400, 'INVALID_MESSAGE', 'Nonce not found in message.', origin);
        const nonce = nonceMatch[1];

        const storedNonce = await env.API_KEYS.get(`nonce:${nonce}`);
        if (!storedNonce) return jsonError(400, 'INVALID_NONCE', 'Nonce expired or invalid.', origin);
        await env.API_KEYS.delete(`nonce:${nonce}`);

        const isValid = await verifyMessage({
          address: address as `0x${string}`,
          message,
          signature: signature as `0x${string}`,
        });

        if (!isValid) return jsonError(401, 'INVALID_SIGNATURE', 'Signature verification failed.', origin);

        // Notify Gateway to register/welcome the user and grant welcome credits
        try {
          const gatewayUrl = env.GATEWAY_URL.replace(/\/$/, '');
          await fetch(`${gatewayUrl}/admin/register-user`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': env.ADMIN_API_KEY || '',
            },
            body: JSON.stringify({ address: address.toLowerCase() }),
          });
        } catch (registerErr) {
          console.error('Failed to notify gateway of user registration:', registerErr);
        }

        const token = await jwt.sign({
          address: address.toLowerCase(),
          exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60) // 30 days
        }, env.JWT_SECRET || 'default_dev_secret');

        return new Response(JSON.stringify({ token }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        return jsonError(500, 'INTERNAL_ERROR', 'Verification failed.', origin);
      }
    }

    // ── Public Webhook Bypasses (no auth) ─────────────────────────────────
    if (url.pathname === '/api/v1/public/webhooks/nowpayments' ||
        url.pathname === '/api/v1/public/webhooks/circle') {
      const targetUrl = env.GATEWAY_URL.replace(/\/$/, '') + url.pathname + url.search;
      const proxyReq = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });
      try {
        const resp = await fetch(proxyReq);
        const body = await resp.arrayBuffer();
        return new Response(body, {
          status: resp.status,
          headers: {
            'Content-Type': resp.headers.get('Content-Type') ?? 'application/json',
            ...corsHeaders(origin),
          },
        });
      } catch {
        return jsonError(502, 'GATEWAY_ERROR', 'Gateway unreachable.', origin);
      }
    }

    // ── Internal Update Tier Route (from Gateway) ──────────────────────────
    if (url.pathname === '/api/v1/internal/update-tier' && request.method === 'POST') {
      const internalSecret = request.headers.get('X-Gateway-Secret');
      if (!env.ADMIN_API_KEY || internalSecret !== env.ADMIN_API_KEY) {
        return jsonError(403, 'FORBIDDEN', 'Invalid gateway internal secret.', origin);
      }
      try {
        const { address, tier } = await request.json() as { address: string; tier: string };
        if (!address || !tier) {
          return jsonError(400, 'BAD_REQUEST', 'Missing address or tier.', origin);
        }
        await env.API_KEYS.put(`user_tier:${address.toLowerCase()}`, tier.toLowerCase());
        return new Response(JSON.stringify({ success: true, address, tier }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err: any) {
        return jsonError(500, 'INTERNAL_ERROR', err.message || 'Failed to update tier.', origin);
      }
    }

    // ── MCP SSE transport ──────────────────────────────────────────────────
    // GET /mcp/sse?api_key=... — establish SSE stream, authenticate via query param
    if (url.pathname === '/mcp/sse' && request.method === 'GET') {
      const apiKeyParam = url.searchParams.get('api_key') ?? '';
      if (!apiKeyParam) {
        return jsonError(401, 'MISSING_API_KEY', 'api_key query parameter required.', origin);
      }

      const keyHash = await sha256(apiKeyParam);
      const keyJson = await env.API_KEYS.get(keyHash);
      if (!keyJson) {
        return jsonError(401, 'INVALID_API_KEY', 'API key not recognised.', origin);
      }
      const keyRecord: ApiKeyRecord = JSON.parse(keyJson);
      if (!keyRecord.active) {
        return jsonError(403, 'KEY_REVOKED', 'API key has been revoked.', origin);
      }

      const sessionId = crypto.randomUUID();
      // Store session metadata; TTL 1 hour matches SSE keep-alive window
      await env.API_KEYS.put(
        `mcp_session:${sessionId}`,
        JSON.stringify({ tier: keyRecord.tier, ownerId: keyRecord.ownerId, keyHash }),
        { expirationTtl: 3600 }
      );

      const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
      const writer = writable.getWriter();
      const enc = new TextEncoder();

      // SSE: advertise the message endpoint immediately, then poll for replies
      const ctx = request as unknown as { waitUntil: (p: Promise<unknown>) => void };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ctx as any).passThroughOnException?.();

      const sseTask = (async () => {
        try {
          const endpointEvent = `event: endpoint\ndata: /mcp/message?session=${sessionId}\n\n`;
          await writer.write(enc.encode(endpointEvent));

          // Poll up to 55s for a KV message; send heartbeats every 5s to keep stream alive
          const deadline = Date.now() + 55_000;
          let lastHeartbeat = Date.now();
          while (Date.now() < deadline) {
            const msg = await env.API_KEYS.get(`mcp_msg:${sessionId}`);
            if (msg) {
              await env.API_KEYS.delete(`mcp_msg:${sessionId}`);
              await writer.write(enc.encode(`data: ${msg}\n\n`));
              break;
            }
            // Send SSE heartbeat every 5s so client doesn't timeout
            if (Date.now() - lastHeartbeat > 5_000) {
              await writer.write(enc.encode(': ping\n\n'));
              lastHeartbeat = Date.now();
            }
            await new Promise(r => setTimeout(r, 300));
          }

          await writer.write(enc.encode(': keep-alive\n\n'));
        } catch { /* stream closed by client */ } finally {
          await writer.close().catch(() => {});
        }
      })();

      // Use waitUntil if available (Workers context)
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (request as any).cf;
        // In real Worker env the execution context is passed separately; we rely on the
        // response being streamed — the task runs concurrently with streaming.
        void sseTask;
      } catch { void sseTask; }

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
          ...corsHeaders(origin),
        },
      });
    }

    // POST /mcp/message?session=... — bridge client message to SSE stream via KV
    if (url.pathname === '/mcp/message' && request.method === 'POST') {
      const sessionId = url.searchParams.get('session') ?? '';
      if (!sessionId) {
        return jsonError(400, 'BAD_REQUEST', 'session query parameter required.', origin);
      }

      const sessionJson = await env.API_KEYS.get(`mcp_session:${sessionId}`);
      if (!sessionJson) {
        return jsonError(401, 'INVALID_SESSION', 'Session not found or expired.', origin);
      }
      const session = JSON.parse(sessionJson) as { tier: string; ownerId: string; keyHash: string };

      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return jsonError(400, 'BAD_REQUEST', 'Invalid JSON body.', origin);
      }

      // Fire gateway call in background — return 202 immediately so the MCP client
      // doesn't timeout waiting. The SSE stream polls KV for the result.
      const gatewayUrl = env.GATEWAY_URL.replace(/\/$/, '') + '/api/v1/mcp';
      ctx.waitUntil(
        fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-ArbiSim-Tier': session.tier,
            'X-ArbiSim-Owner': session.ownerId,
            'X-ArbiSim-Key-Hash': session.keyHash.slice(0, 8),
          },
          body: JSON.stringify(body),
        })
          .then(r => r.text())
          .then(text => env.API_KEYS.put(`mcp_msg:${sessionId}`, text, { expirationTtl: 60 }))
          .catch(err => console.error('MCP gateway error:', err))
      );

      return new Response(JSON.stringify({ ok: true }), {
        status: 202,
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    const rawKey =
      request.headers.get('X-API-Key') ??
      request.headers.get('Authorization')?.replace('Bearer ', '') ??
      null;

    if (!rawKey) {
      return jsonError(401, 'MISSING_API_KEY', 'Provide your API key via X-API-Key header.', origin);
    }

    // ── Demo / Guest key bypass: proxy directly to GATEWAY_URL ───────────────
    if (rawKey === 'demo' || rawKey === 'guest' || rawKey.startsWith('demo_') || rawKey.startsWith('guest_')) {
      const targetUrl = env.GATEWAY_URL.replace(/\/$/, '') + url.pathname + url.search;
      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'X-ArbiSim-Tier': 'developer',
          'X-ArbiSim-Owner': 'guest_demo_user',
          'X-ArbiSim-Key-Hash': 'demo_hash',
        },
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      });
      try {
        const response = await fetch(proxyRequest);
        const body = await response.arrayBuffer();
        return new Response(body, {
          status: response.status,
          headers: {
            'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
            'X-ArbiSim-Tier': 'developer',
            ...corsHeaders(origin),
          },
        });
      } catch {
        return jsonError(502, 'GATEWAY_ERROR', 'Simulation engine unreachable.', origin);
      }
    }

    // ── Admin routes: validate against ADMIN_API_KEY secret, bypass KV ───────
    if (url.pathname.startsWith('/admin/') || url.pathname === '/admin') {
      if (!env.ADMIN_API_KEY || rawKey !== env.ADMIN_API_KEY) {
        return jsonError(403, 'FORBIDDEN', 'Invalid admin key.', origin);
      }
      const adminTarget = env.GATEWAY_URL.replace(/\/$/, '') + url.pathname + url.search;
      const adminProxy = new Request(adminTarget, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'X-ArbiSim-Tier': 'admin',
        },
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      });
      try {
        const adminResp = await fetch(adminProxy);
        const adminBody = await adminResp.arrayBuffer();
        return new Response(adminBody, {
          status: adminResp.status,
          headers: {
            'Content-Type': adminResp.headers.get('Content-Type') ?? 'application/json',
            ...corsHeaders(origin),
          },
        });
      } catch {
        return jsonError(502, 'GATEWAY_ERROR', 'Gateway unreachable.', origin);
      }
    }

    // ── User Billing & Tiers ───────────────────────────────────────────────
    if (url.pathname === '/api/v1/billing/tier' && request.method === 'GET') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonError(401, 'UNAUTHORIZED', 'Missing bearer token.', origin);
      }
      const token = authHeader.replace('Bearer ', '');
      const isValid = await jwt.verify(token, env.JWT_SECRET || 'default_dev_secret');
      if (!isValid) return jsonError(401, 'UNAUTHORIZED', 'Invalid or expired token.', origin);
      
      const decoded = jwt.decode(token) as { payload: { address: string } };
      const address = decoded.payload.address.toLowerCase();

      const userTier = (await env.API_KEYS.get(`user_tier:${address}`)) ?? 'free';
      return new Response(JSON.stringify({ tier: userTier }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
      });
    }

    if (url.pathname === '/api/v1/billing/checkout' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonError(401, 'UNAUTHORIZED', 'Missing bearer token.', origin);
      }
      const token = authHeader.replace('Bearer ', '');
      const isValid = await jwt.verify(token, env.JWT_SECRET || 'default_dev_secret');
      if (!isValid) return jsonError(401, 'UNAUTHORIZED', 'Invalid or expired token.', origin);
      
      const decoded = jwt.decode(token) as { payload: { address: string } };
      const address = decoded.payload.address.toLowerCase();

      try {
        const { tier } = await request.json() as { tier: string };
        if (!tier) {
          return jsonError(400, 'BAD_REQUEST', 'Missing tier.', origin);
        }

        // Forward creation to Gateway
        const targetUrl = env.GATEWAY_URL.replace(/\/$/, '') + '/admin/create-checkout';
        const verifyResp = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': env.ADMIN_API_KEY,
          },
          body: JSON.stringify({ address, tier }),
        });

        if (!verifyResp.ok) {
          const errData = await verifyResp.json().catch(() => ({})) as any;
          return jsonError(verifyResp.status, 'CHECKOUT_FAILED', errData?.error?.message ?? 'Failed to create checkout.', origin);
        }

        const data = await verifyResp.json() as any;
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err: any) {
        return jsonError(500, 'INTERNAL_ERROR', err.message || 'Checkout creation failed.', origin);
      }
    }

    if (url.pathname === '/api/v1/billing/upgrade' && request.method === 'POST') {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonError(401, 'UNAUTHORIZED', 'Missing bearer token.', origin);
      }
      const token = authHeader.replace('Bearer ', '');
      const isValid = await jwt.verify(token, env.JWT_SECRET || 'default_dev_secret');
      if (!isValid) return jsonError(401, 'UNAUTHORIZED', 'Invalid or expired token.', origin);
      
      const decoded = jwt.decode(token) as { payload: { address: string } };
      const address = decoded.payload.address.toLowerCase();

      try {
        const { txHash, tier } = await request.json() as { txHash: string; tier: string };
        if (!txHash || !tier) {
          return jsonError(400, 'BAD_REQUEST', 'Missing txHash or tier.', origin);
        }

        // Forward verification to Gateway
        const targetUrl = env.GATEWAY_URL.replace(/\/$/, '') + '/admin/verify-upgrade';
        const verifyResp = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': env.ADMIN_API_KEY,
          },
          body: JSON.stringify({ address, txHash, tier }),
        });

        if (!verifyResp.ok) {
          const errData = await verifyResp.json().catch(() => ({})) as any;
          return jsonError(verifyResp.status, 'UPGRADE_FAILED', errData?.error?.message ?? 'Failed to verify transaction.', origin);
        }

        // Transaction verified successfully! Store the updated tier in KV
        await env.API_KEYS.put(`user_tier:${address}`, tier);

        return new Response(JSON.stringify({ success: true, tier }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err: any) {
        return jsonError(500, 'INTERNAL_ERROR', err.message || 'Upgrade failed.', origin);
      }
    }

    // ── Proxy user-facing admin routes (credits/referrals) via JWT verification ──
    if (url.pathname.startsWith('/api/v1/admin/')) {
      const token = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
      if (!token) {
        return jsonError(401, 'UNAUTHORIZED', 'Missing token.', origin);
      }
      const isValid = await jwt.verify(token, env.JWT_SECRET || 'default_dev_secret');
      if (!isValid) return jsonError(401, 'UNAUTHORIZED', 'Invalid or expired token.', origin);

      const decoded = jwt.decode(token) as { payload: { address: string } };
      const address = decoded?.payload?.address?.toLowerCase() || '';

      // Forward to Gateway admin endpoints: /api/v1/admin/* -> /admin/*
      const gatewayPath = url.pathname.replace('/api/v1', '');
      const targetUrl = env.GATEWAY_URL.replace(/\/$/, '') + gatewayPath + url.search;

      const proxyRequest = new Request(targetUrl, {
        method: request.method,
        headers: {
          ...Object.fromEntries(request.headers.entries()),
          'X-API-Key': env.ADMIN_API_KEY || '',
          'X-User-Wallet': address,
        },
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
      });

      try {
        const proxyResp = await fetch(proxyRequest);
        const body = await proxyResp.arrayBuffer();
        return new Response(body, {
          status: proxyResp.status,
          headers: {
            'Content-Type': proxyResp.headers.get('Content-Type') ?? 'application/json',
            ...corsHeaders(origin),
          },
        });
      } catch {
        return jsonError(502, 'GATEWAY_ERROR', 'Gateway unreachable.', origin);
      }
    }

    // ── User API Keys Management ───────────────────────────────────────────
    if (url.pathname.startsWith('/api/v1/keys')) {
      const authHeader = request.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return jsonError(401, 'UNAUTHORIZED', 'Missing bearer token.', origin);
      }
      const token = authHeader.replace('Bearer ', '');
      const isValid = await jwt.verify(token, env.JWT_SECRET || 'default_dev_secret');
      if (!isValid) return jsonError(401, 'UNAUTHORIZED', 'Invalid or expired token.', origin);
      
      const decoded = jwt.decode(token) as { payload: { address: string } };
      const address = decoded.payload.address;

      if (request.method === 'POST') {
        const { tier, name } = await request.json() as any;
        const validTiers = ['free', 'builder', 'protocol', 'admin'];
        if (!validTiers.includes(tier)) return jsonError(400, 'BAD_REQUEST', 'Invalid tier.', origin);

        const userTier = (await env.API_KEYS.get(`user_tier:${address.toLowerCase()}`)) ?? 'free';
        const tierHierarchy: Record<string, number> = {
          free: 0,
          builder: 1,
          protocol: 2,
          admin: 3
        };

        const requestedTierValue = tierHierarchy[tier] ?? 0;
        const userTierValue = tierHierarchy[userTier] ?? 0;

        if (requestedTierValue > userTierValue) {
          return jsonError(
            403,
            'INSUFFICIENT_TIER',
            `Your account tier (${userTier}) is not allowed to create a ${tier} key. Upgrade your account first.`,
            origin
          );
        }

        // Generate key
        const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
          .map(b => b.toString(16).padStart(2, '0')).join('');
        const fullKey = `ask_${tier}_${rand.slice(0, 8)}.${rand.slice(8)}`;
        const keyHash = await sha256(fullKey);

        const record: ApiKeyRecord = {
          tier,
          monthlyLimit: TIER_LIMITS[tier as keyof typeof TIER_LIMITS]?.perMinute * 60 * 24 * 30 || 10000,
          minuteLimit: TIER_LIMITS[tier as keyof typeof TIER_LIMITS]?.perMinute || 10,
          ownerId: address,
          active: true,
        };

        await env.API_KEYS.put(keyHash, JSON.stringify(record));

        // Store index so user can list their keys
        const userKeysStr = await env.API_KEYS.get(`user_keys:${address}`);
        const userKeys = userKeysStr ? JSON.parse(userKeysStr) : [];
        const newKeyEntry = {
          id: crypto.randomUUID(),
          prefix: `ask_${tier}_${rand.slice(0, 8)}.••••••••`,
          tier,
          hash: keyHash, // needed to revoke later
          createdAt: new Date().toISOString(),
          active: true,
        };
        userKeys.push(newKeyEntry);
        await env.API_KEYS.put(`user_keys:${address}`, JSON.stringify(userKeys));

        return new Response(JSON.stringify({ ...newKeyEntry, fullKey }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      if (request.method === 'GET') {
        const userKeysStr = await env.API_KEYS.get(`user_keys:${address}`);
        return new Response(userKeysStr || '[]', {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }

      if (request.method === 'DELETE') {
        const { hash } = await request.json() as { hash: string };
        const keyJson = await env.API_KEYS.get(hash);
        if (keyJson) {
          const record: ApiKeyRecord = JSON.parse(keyJson);
          if (record.ownerId === address) {
            record.active = false;
            await env.API_KEYS.put(hash, JSON.stringify(record));
            
            // update index
            const userKeysStr = await env.API_KEYS.get(`user_keys:${address}`);
            if (userKeysStr) {
              const userKeys = JSON.parse(userKeysStr);
              const updated = userKeys.map((k: any) => k.hash === hash ? { ...k, active: false } : k);
              await env.API_KEYS.put(`user_keys:${address}`, JSON.stringify(updated));
            }
          }
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      }
    }

    const keyHash = await sha256(rawKey);
    const keyJson = await env.API_KEYS.get(keyHash);

    if (!keyJson) {
      return jsonError(401, 'INVALID_API_KEY', 'API key not recognised.', origin);
    }

    const keyRecord: ApiKeyRecord = JSON.parse(keyJson);

    if (!keyRecord.active) {
      return jsonError(403, 'KEY_REVOKED', 'This API key has been revoked.', origin);
    }

    const minuteBucket = `rl:minute:${keyHash}:${Math.floor(Date.now() / 60000)}`;
    const currentCount = Number((await env.API_KEYS.get(minuteBucket)) ?? '0');
    const limit = TIER_LIMITS[keyRecord.tier].perMinute;

    if (currentCount >= limit) {
      const resetIn = 60 - Math.floor((Date.now() % 60000) / 1000);
      return jsonError(
        429,
        'RATE_LIMIT_EXCEEDED',
        `Rate limit: ${limit} requests/minute for ${keyRecord.tier} tier. Resets in ${resetIn}s.`,
        origin
      );
    }

    env.API_KEYS.put(minuteBucket, String(currentCount + 1), { expirationTtl: 120 });

    const targetUrl = env.GATEWAY_URL.replace(/\/$/, '') + url.pathname + url.search;

    const proxyRequest = new Request(targetUrl, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers.entries()),
        'X-ArbiSim-Tier': keyRecord.tier,
        'X-ArbiSim-Owner': keyRecord.ownerId,
        'X-ArbiSim-Key-Hash': keyHash.slice(0, 8),
      },
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
    });

    try {
      const response = await fetch(proxyRequest);
      const body = await response.arrayBuffer();

      return new Response(body, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') ?? 'application/json',
          'X-ArbiSim-Tier': keyRecord.tier,
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': String(limit - currentCount - 1),
          ...corsHeaders(origin),
        },
      });
    } catch {
      return jsonError(502, 'GATEWAY_ERROR', 'Simulation engine unreachable.', origin);
    }
  },
};
