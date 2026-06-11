import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { createWebhook, listWebhooks, deleteWebhook } from '../db.js';

const router = Router();

/**
 * @openapi
 * /api/v1/webhooks:
 *   post:
 *     summary: Register a new webhook endpoint
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeyId = (req as any).apiKeyId;
    if (!apiKeyId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key is required.' } });
      return;
    }

    const { url, events = ['simulation.completed'] } = req.body;
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      res.status(400).json({ error: { code: 'INVALID_URL', message: 'Provide a valid HTTPS/HTTP webhook URL.' } });
      return;
    }

    // Generate random 32-byte secret
    const secret = 'whsec_' + crypto.randomBytes(32).toString('hex');

    const webhook = await createWebhook(apiKeyId, url, secret, events);

    res.status(201).json({
      id: webhook.id,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      created_at: webhook.created_at,
      secret, // Only returned once on creation
    });
  } catch (error) {
    console.error('Failed to create webhook:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to register webhook.' } });
  }
});

/**
 * @openapi
 * /api/v1/webhooks:
 *   get:
 *     summary: List active webhooks registered for the authenticated key
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeyId = (req as any).apiKeyId;
    if (!apiKeyId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key is required.' } });
      return;
    }

    const webhooks = await listWebhooks(apiKeyId);
    res.json({ webhooks });
  } catch (error) {
    console.error('Failed to list webhooks:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list webhooks.' } });
  }
});

/**
 * @openapi
 * /api/v1/webhooks/{id}:
 *   delete:
 *     summary: Deactivate/delete a registered webhook endpoint
 */
router.delete('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeyId = (req as any).apiKeyId;
    if (!apiKeyId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key is required.' } });
      return;
    }

    const { id } = req.params;
    const success = await deleteWebhook(id, apiKeyId);

    if (!success) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Webhook not found or already deactivated.' } });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Failed to delete webhook:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook.' } });
  }
});

export default router;
