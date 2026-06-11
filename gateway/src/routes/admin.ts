import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import argon2 from 'argon2';
import { config } from '../config.js';
import { createApiKey, getApiKeyByPrefix, pgPool } from '../db.js';

const router = Router();

// Guard: all admin routes require ADMIN_API_KEY
router.use((req: Request, res: Response, next) => {
  const key = req.headers['x-api-key'];
  if (!config.api.adminKey || key !== config.api.adminKey) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Invalid admin key.' } });
    return;
  }
  next();
});

const TIER_CONFIG: Record<string, { monthly_quota: number; per_minute: number }> = {
  free:       { monthly_quota: 500,    per_minute: 10  },
  pro:        { monthly_quota: 10000,  per_minute: 60  },
  enterprise: { monthly_quota: 100000, per_minute: 300 },
};

/**
 * POST /admin/api-keys
 * Creates a real API key: Argon2id-hashed in Neon + SHA-256 seed for Cloudflare KV.
 */
router.post('/api-keys', async (req: Request, res: Response): Promise<void> => {
  const { tier = 'free', owner_email } = req.body as { tier?: string; owner_email?: string };

  if (!TIER_CONFIG[tier]) {
    res.status(400).json({
      error: { code: 'INVALID_TIER', message: `tier must be one of: ${Object.keys(TIER_CONFIG).join(', ')}` },
    });
    return;
  }

  // Key format: ask_{tier}_{8 hex chars}.{64 hex chars}
  // - prefix   = everything before the dot  → indexed lookup in Neon
  // - full key = what the caller stores      → Argon2id-hashed in Neon, SHA-256 in CF KV
  const prefix  = `ask_${tier}_${crypto.randomBytes(4).toString('hex')}`;
  const secret  = crypto.randomBytes(32).toString('hex');
  const fullKey = `${prefix}.${secret}`;

  // Argon2id — OWASP minimum: 19 MiB memory, 2 iterations, parallelism 1
  const hash = await argon2.hash(fullKey, {
    type:        argon2.argon2id,
    memoryCost:  19456,
    timeCost:    2,
    parallelism: 1,
  });

  // SHA-256 of the full key — what Cloudflare KV indexes on
  const sha256 = crypto.createHash('sha256').update(fullKey).digest('hex');

  try {
    const row = await createApiKey(prefix, hash, tier, owner_email);

    const kvValue = JSON.stringify({
      tier,
      monthlyLimit: TIER_CONFIG[tier].monthly_quota,
      minuteLimit:  TIER_CONFIG[tier].per_minute,
      ownerId:      owner_email ?? prefix,
      active:       true,
    });

    res.status(201).json({
      // Full key shown ONCE — never stored in plaintext, never retrievable again
      key:        fullKey,
      prefix,
      tier,
      id:         row.id,
      created_at: row.created_at,
      // Everything the caller needs to seed Cloudflare KV
      cf_kv: {
        hash:    sha256,
        value:   kvValue,
        // Ready-to-run wrangler command
        command: `wrangler kv key put --namespace-id YOUR_NS_ID "${sha256}" '${kvValue}'`,
      },
    });
  } catch (err: any) {
    console.error('Failed to create API key:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create API key.' } });
  }
});

/**
 * GET /admin/api-keys
 * Lists all active keys (prefixes only — hashes never returned).
 */
router.get('/api-keys', async (_req: Request, res: Response): Promise<void> => {
  try {
    const result = await pgPool.query(
      `SELECT id, prefix, tier, monthly_quota, owner_email, created_at, revoked_at
       FROM api_keys
       ORDER BY created_at DESC
       LIMIT 100`
    );
    res.json({ keys: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list keys.' } });
  }
});

/**
 * DELETE /admin/api-keys/:prefix
 * Revokes a key by setting revoked_at.
 */
router.delete('/api-keys/:prefix', async (req: Request, res: Response): Promise<void> => {
  const { prefix } = req.params;
  try {
    const record = await getApiKeyByPrefix(prefix);
    if (!record) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Key not found.' } });
      return;
    }
    await pgPool.query(
      `UPDATE api_keys SET revoked_at = NOW() WHERE prefix = $1`,
      [prefix]
    );
    res.json({ revoked: true, prefix });
  } catch (err: any) {
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to revoke key.' } });
  }
});

export default router;
