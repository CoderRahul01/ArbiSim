import { Request, Response, NextFunction } from 'express';
import argon2 from 'argon2';
import { config } from '../config.js';
import { getApiKeyByPrefix } from '../db.js';

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  // ── Path 1: Cloudflare Worker already validated the key ──────────────────
  // CF forwards X-ArbiSim-Tier after its own KV lookup + rate-limit check.
  // Trust it — no need to re-hash.
  const cfTier = req.headers['x-arbisim-tier'] as string | undefined;
  if (cfTier) {
    (req as any).tier    = cfTier;
    (req as any).ownerId = req.headers['x-arbisim-owner'];
    next();
    return;
  }

  // ── Path 2: Direct call (MCP, local dev, tests) ──────────────────────────
  const rawKey =
    (req.headers['x-api-key'] as string | undefined) ??
    (req.headers['authorization'] as string | undefined)?.replace(/^Bearer\s+/i, '');

  if (!rawKey) {
    res.status(401).json({
      error: { code: 'MISSING_API_KEY', message: 'Provide your API key via X-API-Key header.' },
    });
    return;
  }

  // Admin bypass — single secret for gateway-internal and admin UI calls
  if (config.api.adminKey && rawKey === config.api.adminKey) {
    (req as any).tier = 'admin';
    next();
    return;
  }

  // Key format: ask_{tier}_{8hex}.{64hex}  — prefix is everything before the dot
  const dotIndex = rawKey.indexOf('.');
  if (dotIndex === -1) {
    res.status(401).json({
      error: { code: 'INVALID_KEY_FORMAT', message: 'API key format is invalid.' },
    });
    return;
  }

  const prefix = rawKey.slice(0, dotIndex);

  // Fast indexed lookup by prefix — avoids full table scan
  let record: { id: string; hash: string; tier: string } | null;
  try {
    record = await getApiKeyByPrefix(prefix);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Auth lookup failed.' } });
    return;
  }

  if (!record) {
    res.status(401).json({ error: { code: 'INVALID_API_KEY', message: 'API key not recognised.' } });
    return;
  }

  // Argon2id timing-safe verify — defends against timing attacks
  let valid: boolean;
  try {
    valid = await argon2.verify(record.hash, rawKey);
  } catch {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Auth verification failed.' } });
    return;
  }

  if (!valid) {
    res.status(401).json({ error: { code: 'INVALID_API_KEY', message: 'API key not recognised.' } });
    return;
  }

  (req as any).tier     = record.tier;
  (req as any).apiKeyId = record.id;
  next();
}
