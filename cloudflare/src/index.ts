export interface Env {
  API_KEYS: KVNamespace;
  GATEWAY_URL: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  ADMIN_API_KEY: string;
  JWT_SECRET: string;
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
  async fetch(request: Request, env: Env): Promise<Response> {
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

    const rawKey =
      request.headers.get('X-API-Key') ??
      request.headers.get('Authorization')?.replace('Bearer ', '') ??
      null;

    if (!rawKey) {
      return jsonError(401, 'MISSING_API_KEY', 'Provide your API key via X-API-Key header.', origin);
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

        const token = await jwt.sign({
          address: address.toLowerCase(),
          exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 1 day
        }, env.JWT_SECRET || 'default_dev_secret');

        return new Response(JSON.stringify({ token }), {
          headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
        });
      } catch (err) {
        return jsonError(500, 'INTERNAL_ERROR', 'Verification failed.', origin);
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
