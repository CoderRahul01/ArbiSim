import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import argon2 from 'argon2';
import { ethers } from 'ethers';
import { config } from '../config.js';
import {
  createApiKey, getApiKeyByPrefix, pgPool, isPaymentVerified, recordPayment,
  getOrCreateUser, getUserCredits, addCredits, getCreditHistory,
  createReferralCode, redeemReferralCode
} from '../db.js';

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

const CREDIT_PACKS: Record<string, { credits: number; price_usd: number; label: string }> = {
  credit_500:   { credits: 500,   price_usd: 9,    label: 'Starter Pack (500 credits)' },
  credit_2500:  { credits: 2500,  price_usd: 39,   label: 'Builder Pack (2,500 credits)' },
  credit_10000: { credits: 10000, price_usd: 129,  label: 'Protocol Pack (10,000 credits)' },
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

/**
 * POST /admin/verify-upgrade
 * Verifies a Web3 transaction on Arbitrum One or Arbitrum Sepolia
 * and returns success if valid.
 */
router.post('/verify-upgrade', async (req: Request, res: Response): Promise<void> => {
  const { address, txHash, tier } = req.body as { address: string; txHash: string; tier: string };

  if (!address || !txHash || !tier) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing address, txHash, or tier.' } });
    return;
  }

  // Prevent replay attacks
  try {
    const isAlreadyUsed = await isPaymentVerified(txHash);
    if (isAlreadyUsed) {
      res.status(400).json({ error: { code: 'REPLAY_ATTACK', message: 'This transaction hash has already been used for an upgrade.' } });
      return;
    }
  } catch (err) {
    console.error('Failed to query verified payments:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to verify transaction replay.' } });
    return;
  }

  const targetTier = tier.toLowerCase();
  const validTiers = ['builder', 'protocol'];
  if (!validTiers.includes(targetTier)) {
    res.status(400).json({ error: { code: 'INVALID_TIER', message: 'Can only upgrade to builder or protocol tiers.' } });
    return;
  }

  const chainId = process.env.NEXT_PUBLIC_ARBITRUM_CHAIN_ID || '42161';
  const isSepolia = chainId === '421614';
  const rpcUrl = isSepolia
    ? (process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://sepolia-rollup.arbitrum.io/rpc')
    : (process.env.ARBITRUM_ONE_RPC ?? 'https://arb1.arbitrum.io/rpc');

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  let tx: ethers.TransactionResponse | null = null;
  let receipt: ethers.TransactionReceipt | null = null;

  try {
    tx = await provider.getTransaction(txHash);
    if (tx) {
      receipt = await provider.getTransactionReceipt(txHash);
    }
  } catch (e) {
    console.error('Failed to fetch transaction from RPC:', e);
  }

  if (!tx || !receipt) {
    res.status(400).json({ error: { code: 'TRANSACTION_NOT_FOUND', message: `Transaction not found on the configured Arbitrum network (Chain ID: ${chainId}).` } });
    return;
  }

  if (receipt.status !== 1) {
    res.status(400).json({ error: { code: 'TRANSACTION_FAILED', message: 'Transaction has failed status.' } });
    return;
  }

  if (tx.from.toLowerCase() !== address.toLowerCase()) {
    res.status(400).json({ error: { code: 'SENDER_MISMATCH', message: 'Transaction was not sent by this wallet address.' } });
    return;
  }

  const merchantAddress = (process.env.MERCHANT_ADDRESS || '0x4FE1137021102A860Ff374Db8fB13bA78A00f9dD').toLowerCase();
  if (tx.to?.toLowerCase() !== merchantAddress) {
    res.status(400).json({ error: { code: 'RECIPIENT_MISMATCH', message: `Transaction recipient must be the merchant address: ${merchantAddress}` } });
    return;
  }

  // Value checks:
  // builder (Pro) needs at least 0.001 ETH
  // protocol (Enterprise) needs at least 0.01 ETH
  const minEth = targetTier === 'protocol' ? '0.01' : '0.001';
  const valEth = ethers.formatEther(tx.value);
  if (parseFloat(valEth) < parseFloat(minEth)) {
    res.status(400).json({ error: { code: 'INSUFFICIENT_PAYMENT', message: `Expected at least ${minEth} ETH, received ${valEth} ETH.` } });
    return;
  }

  // Record successful payment to prevent future replay of this transaction
  try {
    await recordPayment(txHash, address, targetTier, valEth);
  } catch (err) {
    console.error('Failed to record payment:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to save payment record.' } });
    return;
  }

  res.json({ success: true, tier: targetTier });
});

/**
 * POST /admin/create-checkout
 * Creates a NOWPayments hosted checkout invoice.
 */
router.post('/create-checkout', async (req: Request, res: Response): Promise<void> => {
  const { address, tier } = req.body as { address: string; tier: string };

  if (!address || !tier) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing address or tier.' } });
    return;
  }

  const targetTier = tier.toLowerCase();
  const validTiers = ['builder', 'protocol'];
  if (!validTiers.includes(targetTier)) {
    res.status(400).json({ error: { code: 'INVALID_TIER', message: 'Can only upgrade to builder or protocol tiers.' } });
    return;
  }

  const amount = targetTier === 'protocol' ? 299 : 29; // Pro = $29, Enterprise = $299
  const description = `ArbiSim Guard Subscription: ${targetTier.toUpperCase()} Plan`;
  
  // orderId encodes address and tier and timestamp to make webhook processing stateless
  const orderId = `${address.toLowerCase()}:${targetTier}:${Date.now()}`;

  try {
    const { NowPaymentsSDK } = await import('@nowpaymentsio/nowpayments-sdk-nodejs');
    const sdk = new NowPaymentsSDK({
      apiKey: process.env.NOWPAYMENTS_API_KEY || '',
      ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || '',
      ipnCallbackUrl: process.env.NOWPAYMENTS_IPN_CALLBACK_URL || 'https://arbisim-proxy.workers.dev/api/v1/public/webhooks/nowpayments',
      successUrl: process.env.NOWPAYMENTS_SUCCESS_URL || 'https://arbisimguard.vercel.app/dashboard/billing?status=success',
      cancelUrl: process.env.NOWPAYMENTS_CANCEL_URL || 'https://arbisimguard.vercel.app/dashboard/billing?status=cancel',
    });

    const checkout = await sdk.createCheckout({
      amount,
      currency: 'usd',
      orderId,
      description,
    });

    res.json({
      success: true,
      invoice_url: checkout.invoice_url,
      id: checkout.id,
    });
  } catch (err: any) {
    console.error('Failed to create NOWPayments checkout:', err);
    res.status(500).json({ error: { code: 'NOWPAYMENTS_ERROR', message: err.message || 'Failed to create checkout invoice.' } });
  }
});

/**
 * POST /admin/register-user
 * Registers a wallet address and grants 50 welcome credits.
 */
router.post('/register-user', async (req: Request, res: Response): Promise<void> => {
  const { address } = req.body as { address: string };
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid wallet address.' } });
    return;
  }
  try {
    const user = await getOrCreateUser(address);
    // Grant welcome credits only for brand-new users (balance is 0 and no purchase history)
    if (user.total_purchased === 0 && user.total_consumed === 0 && user.credit_balance === 0) {
      await addCredits(address, 50, 'welcome_bonus', 'Welcome bonus - 50 free simulation credits');
    }
    const balance = await getUserCredits(address);
    res.json({ success: true, wallet_address: address.toLowerCase(), credit_balance: balance });
  } catch (err: any) {
    console.error('Failed to register user:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to register user.' } });
  }
});

/**
 * GET /admin/credit-balance?address=0x...
 * Returns credit balance and recent transaction history.
 */
router.get('/credit-balance', async (req: Request, res: Response): Promise<void> => {
  const address = req.query.address as string;
  if (!address) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing address query param.' } });
    return;
  }

  const xWallet = req.headers['x-user-wallet'] as string | undefined;
  if (xWallet && address.toLowerCase() !== xWallet.toLowerCase()) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Wallet address mismatch.' } });
    return;
  }

  try {
    const user = await getOrCreateUser(address);
    let referralCode = user.referral_code;

    if (!referralCode) {
      referralCode = `AS-${address.slice(2, 8).toUpperCase()}`;
      try {
        await createReferralCode(address, referralCode);
      } catch (err: any) {
        if (err.code === '23505') {
          const suffix = crypto.randomBytes(2).toString('hex').toUpperCase();
          referralCode = `AS-${address.slice(2, 6).toUpperCase()}-${suffix}`;
          await createReferralCode(address, referralCode);
        } else {
          throw err;
        }
      }
    }

    const history = await getCreditHistory(address, 25);
    res.json({
      wallet_address: user.wallet_address,
      credit_balance: user.credit_balance,
      total_purchased: user.total_purchased,
      total_consumed: user.total_consumed,
      referral_code: referralCode,
      history,
    });
  } catch (err: any) {
    console.error('Failed to get credit balance:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch credit balance.' } });
  }
});

/**
 * POST /admin/credit-checkout
 * Creates a NOWPayments checkout for a credit pack purchase.
 */
router.post('/credit-checkout', async (req: Request, res: Response): Promise<void> => {
  const { address, pack } = req.body as { address: string; pack: string };
  if (!address || !pack) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing address or pack.' } });
    return;
  }
  const packConfig = CREDIT_PACKS[pack];
  if (!packConfig) {
    res.status(400).json({
      error: { code: 'INVALID_PACK', message: `Pack must be one of: ${Object.keys(CREDIT_PACKS).join(', ')}` },
    });
    return;
  }

  const orderId = `credit:${address.toLowerCase()}:${pack}:${Date.now()}`;

  try {
    const { NowPaymentsSDK } = await import('@nowpaymentsio/nowpayments-sdk-nodejs');
    const sdk = new NowPaymentsSDK({
      apiKey: process.env.NOWPAYMENTS_API_KEY || '',
      ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || '',
      ipnCallbackUrl: process.env.NOWPAYMENTS_IPN_CALLBACK_URL || 'https://arbisim-proxy.workers.dev/api/v1/public/webhooks/nowpayments',
      successUrl: process.env.NOWPAYMENTS_SUCCESS_URL || 'https://arbisimguard.vercel.app/dashboard/billing?status=success',
      cancelUrl: process.env.NOWPAYMENTS_CANCEL_URL || 'https://arbisimguard.vercel.app/dashboard/billing?status=cancel',
    });

    const checkout = await sdk.createCheckout({
      amount: packConfig.price_usd,
      currency: 'usd',
      orderId,
      description: `ArbiSim Guard ${packConfig.label}`,
    });

    res.json({
      success: true,
      invoice_url: checkout.invoice_url,
      id: checkout.id,
      pack,
      credits: packConfig.credits,
      price_usd: packConfig.price_usd,
    });
  } catch (err: any) {
    console.error('Failed to create credit checkout:', err);
    res.status(500).json({ error: { code: 'NOWPAYMENTS_ERROR', message: err.message || 'Failed to create checkout.' } });
  }
});

/**
 * POST /admin/circle-credit-checkout
 * Creates a Circle USDC payment intent for a credit pack purchase.
 * Returns a USDC deposit address on Arbitrum - no redirect needed.
 */
router.post('/circle-credit-checkout', async (req: Request, res: Response): Promise<void> => {
  const { address, pack } = req.body as { address: string; pack: string };
  if (!address || !pack) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing address or pack.' } });
    return;
  }
  const packConfig = CREDIT_PACKS[pack];
  if (!packConfig) {
    res.status(400).json({
      error: { code: 'INVALID_PACK', message: `Pack must be one of: ${Object.keys(CREDIT_PACKS).join(', ')}` },
    });
    return;
  }

  const idempotencyKey = `credit:${address.toLowerCase()}:${pack}:${Date.now()}`;

  try {
    const { createCirclePaymentIntent } = await import('../services/circle.js');
    const intent = await createCirclePaymentIntent({
      idempotencyKey,
      amountUsd: packConfig.price_usd,
      description: `ArbiSim Guard ${packConfig.label}`,
    });

    const method = intent.paymentMethods?.[0];
    res.json({
      success: true,
      payment_id: intent.id,
      payment_address: method?.address ?? null,
      chain: method?.chain ?? 'ARB',
      amount_usdc: packConfig.price_usd.toFixed(2),
      credits: packConfig.credits,
      pack,
    });
  } catch (err: any) {
    console.error('Circle checkout error:', err);
    res.status(500).json({ error: { code: 'CIRCLE_ERROR', message: err.message || 'Failed to create Circle payment.' } });
  }
});

/**
 * POST /admin/referral/create
 * Creates a referral code for the given wallet.
 */
router.post('/referral/create', async (req: Request, res: Response): Promise<void> => {
  const { address, code } = req.body as { address: string; code: string };
  if (!address || !code || code.length < 4 || code.length > 20) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Invalid address or code (4-20 chars).' } });
    return;
  }

  const xWallet = req.headers['x-user-wallet'] as string | undefined;
  if (xWallet && address.toLowerCase() !== xWallet.toLowerCase()) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Wallet address mismatch.' } });
    return;
  }

  try {
    await getOrCreateUser(address);
    await createReferralCode(address, code);
    res.json({ success: true, code: code.toUpperCase() });
  } catch (err: any) {
    if (err.code === '23505') { // unique constraint violation
      res.status(409).json({ error: { code: 'DUPLICATE_CODE', message: 'This referral code is already taken.' } });
    } else {
      console.error('Failed to create referral code:', err);
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to create referral code.' } });
    }
  }
});

/**
 * POST /admin/referral/redeem
 * Redeems a referral code for the given wallet.
 */
router.post('/referral/redeem', async (req: Request, res: Response): Promise<void> => {
  const { address, code } = req.body as { address: string; code: string };
  if (!address || !code) {
    res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Missing address or code.' } });
    return;
  }

  const xWallet = req.headers['x-user-wallet'] as string | undefined;
  if (xWallet && address.toLowerCase() !== xWallet.toLowerCase()) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Wallet address mismatch.' } });
    return;
  }

  try {
    await getOrCreateUser(address);
    const result = await redeemReferralCode(address, code);
    if (!result.success) {
      res.status(400).json({ error: { code: 'REDEEM_FAILED', message: result.message } });
      return;
    }
    const balance = await getUserCredits(address);
    res.json({ success: true, message: result.message, credit_balance: balance });
  } catch (err: any) {
    console.error('Failed to redeem referral code:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to redeem referral code.' } });
  }
});

export default router;
