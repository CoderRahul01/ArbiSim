import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config.js';

const router = Router();

router.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== config.api.adminKey) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  next();
});

const TIER_LIMITS: Record<string, { monthly: number; perMinute: number }> = {
  free:     { monthly: 500,    perMinute: 10  },
  builder:  { monthly: 10000, perMinute: 60  },
  protocol: { monthly: 100000, perMinute: 300 },
  admin:    { monthly: 9999999, perMinute: 1000 },
};

router.post('/api-keys', async (req, res) => {
  const { tier = 'free', ownerId = 'anonymous' } = req.body;

  if (!TIER_LIMITS[tier]) {
    res.status(400).json({ error: `Invalid tier. Must be one of: ${Object.keys(TIER_LIMITS).join(', ')}` });
    return;
  }

  const raw = `ask_${tier}_${crypto.randomBytes(20).toString('hex')}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');

  const record = {
    tier,
    monthlyLimit: TIER_LIMITS[tier].monthly,
    minuteLimit: TIER_LIMITS[tier].perMinute,
    ownerId,
    active: true,
    createdAt: new Date().toISOString(),
  };

  res.json({
    apiKey: raw,
    keyHash: hash,
    record,
    kvCommand: `wrangler kv key put --namespace-id YOUR_NS_ID "${hash}" '${JSON.stringify(record)}'`,
  });
});

export default router;
