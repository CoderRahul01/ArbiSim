export interface Env {
  API_KEYS: KVNamespace;
  GATEWAY_URL: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  ADMIN_API_KEY: string;
}

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
