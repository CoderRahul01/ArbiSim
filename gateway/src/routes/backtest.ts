import { Router, Request, Response } from 'express';
import { createBacktest, getBacktest, listBacktests } from '../db.js';

const router = Router();

const VALID_NETWORKS = new Set(['arbitrum-one', 'arbitrum-sepolia']);

/**
 * @openapi
 * /api/v1/backtest:
 *   post:
 *     summary: Submit a parameterised strategy for backtesting across a historical block range
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  const {
    network,
    agent_address,
    block_start,
    block_end,
    block_stride = 100,
    strategy,
  } = req.body;

  // ── Validation ────────────────────────────────────────────────────────────
  if (!network || !VALID_NETWORKS.has(network)) {
    res.status(400).json({
      error: { code: 'INVALID_NETWORK', message: "network must be 'arbitrum-one' or 'arbitrum-sepolia'." },
    });
    return;
  }

  if (!agent_address || typeof agent_address !== 'string' || !agent_address.startsWith('0x')) {
    res.status(400).json({
      error: { code: 'INVALID_ADDRESS', message: 'agent_address must be a hex EVM address.' },
    });
    return;
  }

  if (typeof block_start !== 'number' || typeof block_end !== 'number') {
    res.status(400).json({
      error: { code: 'INVALID_BLOCKS', message: 'block_start and block_end must be numbers.' },
    });
    return;
  }

  if (block_end <= block_start) {
    res.status(400).json({
      error: { code: 'INVALID_RANGE', message: 'block_end must be greater than block_start.' },
    });
    return;
  }

  const stride = Number(block_stride);
  if (!Number.isInteger(stride) || stride < 1) {
    res.status(400).json({
      error: { code: 'INVALID_STRIDE', message: 'block_stride must be an integer >= 1.' },
    });
    return;
  }

  const totalBlocks = Math.ceil((block_end - block_start) / stride);
  if (totalBlocks > 5000) {
    res.status(400).json({
      error: {
        code: 'RANGE_TOO_LARGE',
        message: `Block range would produce ${totalBlocks} samples (max 5000). Increase stride or narrow range.`,
      },
    });
    return;
  }

  if (!strategy || typeof strategy !== 'object') {
    res.status(400).json({
      error: { code: 'INVALID_STRATEGY', message: 'strategy must be an object with at least { transactions }.' },
    });
    return;
  }

  // ── Create backtest row ────────────────────────────────────────────────────
  try {
    const apiKeyId = (req as any).apiKeyId ?? null;
    const row = await createBacktest(
      apiKeyId,
      network,
      agent_address,
      strategy,
      block_start,
      block_end,
      stride
    );

    res.status(202).json({
      backtest_id: row.id,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Failed to create backtest:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create backtest.' } });
  }
});

/**
 * @openapi
 * /api/v1/backtest/{id}:
 *   get:
 *     summary: Retrieve a backtest by ID (status + results)
 */
router.get('/:id', async (req: Request, res: Response): Promise<void> => {
  try {
    const row = await getBacktest(req.params.id);
    if (!row) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Backtest not found.' } });
      return;
    }
    res.json(row);
  } catch (error) {
    console.error('Failed to get backtest:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch backtest.' } });
  }
});

/**
 * @openapi
 * /api/v1/backtest:
 *   get:
 *     summary: List recent backtests for the authenticated API key
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeyId = (req as any).apiKeyId ?? null;
    const rows = await listBacktests(apiKeyId);
    res.json({ backtests: rows });
  } catch (error) {
    console.error('Failed to list backtests:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to list backtests.' } });
  }
});

export default router;
