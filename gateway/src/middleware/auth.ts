import { Request, Response, NextFunction } from 'express';
import { config } from '../config.js';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // Trust requests forwarded by the Cloudflare Worker (it validated the key)
  const tier = req.headers['x-arbisim-tier'] as string | undefined;
  if (tier) {
    (req as any).tier = tier;
    (req as any).ownerId = req.headers['x-arbisim-owner'];
    return next();
  }

  // Allow direct admin access for local dev and testing
  const directKey =
    (req.headers['x-api-key'] as string | undefined) ??
    (req.headers['authorization'] as string | undefined)?.replace('Bearer ', '');

  if (config.api.adminKey && directKey === config.api.adminKey) {
    (req as any).tier = 'admin';
    return next();
  }

  res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API key.' } });
}
