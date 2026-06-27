import { Router, Request, Response } from 'express';
import { PostHog } from 'posthog-node';
import { isPaymentVerified, recordPayment, addCredits, getOrCreateUser } from '../db.js';
import { verifyCircleWebhookSecret } from '../services/circle.js';

const phClient = process.env.POSTHOG_API_KEY
  ? new PostHog(process.env.POSTHOG_API_KEY, { host: 'https://us.i.posthog.com' })
  : null;

const CREDIT_PACKS: Record<string, number> = {
  credit_500: 500,
  credit_2500: 2500,
  credit_10000: 10000,
};

const router = Router();

/**
 * POST /api/v1/public/webhooks/circle
 * Handles Circle payment webhook notifications.
 * Circle sends payment status updates when USDC is received on-chain.
 */
router.post('/circle', async (req: Request, res: Response): Promise<void> => {
  try {
    const body = req.body as {
      // Circle gateway.deposit.finalized event format
      Type?: string;
      notification?: {
        depositId?: string;
        depositAddress?: string;
        idempotencyKey?: string;
        amount?: string;
        currency?: string;
        status?: string;
      };
      // Fallback: legacy payments format
      payment?: {
        id: string;
        status: string;
        amount?: { amount: string; currency: string };
        idempotencyKey?: string;
      };
    };

    // Return 200 for verification pings and unrelated events
    const notification = body.notification;
    const payment = body.payment;
    const eventType = body.Type ?? '';

    const isDepositEvent = eventType === 'gateway.deposit.finalized' && notification;
    const isPaymentEvent = payment && payment.status === 'paid';

    if (!isDepositEvent && !isPaymentEvent) {
      res.json({ ok: true });
      return;
    }

    // Validate shared secret only for actual payment/deposit events
    const secret = req.headers['x-circle-webhook-secret'] as string | undefined;
    if (!verifyCircleWebhookSecret(secret ?? '')) {
      res.status(401).json({ error: 'Invalid webhook secret' });
      return;
    }

    // Extract fields from whichever event type fired
    const paymentId = isDepositEvent ? (notification!.depositId ?? '') : payment!.id;
    const idempotencyKey = isDepositEvent ? notification!.idempotencyKey : payment!.idempotencyKey;
    const amountRaw = isDepositEvent ? (notification!.amount ?? '0') : (payment!.amount?.amount ?? '0');

    if (!idempotencyKey) {
      console.error('Circle Webhook: Missing idempotencyKey');
      res.status(400).json({ error: 'Missing idempotencyKey' });
      return;
    }

    console.log(`Circle Webhook: ${eventType || 'payment'} ${paymentId} - key: ${idempotencyKey}`);

    // Dedup guard - same logic as NOWPayments
    const alreadyProcessed = await isPaymentVerified(paymentId);
    if (alreadyProcessed) {
      console.log(`Circle Webhook: ${paymentId} already processed - skipping`);
      res.json({ ok: true });
      return;
    }

    // idempotencyKey format: credit:{walletAddress}:{packId}:{timestamp}
    const parts = idempotencyKey.split(':');
    if (parts[0] !== 'credit' || parts.length < 3) {
      console.error(`Circle Webhook: Unexpected idempotencyKey format: ${idempotencyKey}`);
      res.status(400).json({ error: 'Unexpected idempotencyKey format' });
      return;
    }

    const walletAddress = parts[1].toLowerCase();
    const packId = parts[2];
    const credits = CREDIT_PACKS[packId];
    const amountUsd = amountRaw;

    if (!credits) {
      console.error(`Circle Webhook: Unknown pack ${packId}`);
      res.status(400).json({ error: `Unknown pack: ${packId}` });
      return;
    }

    // Record payment (dedup table) then credit the account
    await recordPayment(paymentId, walletAddress, packId, amountUsd);
    await getOrCreateUser(walletAddress);
    await addCredits(walletAddress, credits, 'purchase', `Circle USDC payment - ${packId}`, paymentId);

    console.log(`Circle Webhook: Credited ${credits} to ${walletAddress} for pack ${packId}`);

    phClient?.capture({
      distinctId: walletAddress,
      event: 'payment_completed',
      properties: { provider: 'circle_usdc', pack: packId, credits, amount: amountUsd, payment_id: paymentId },
    });

    res.json({ ok: true });
  } catch (err: any) {
    console.error('Circle Webhook: Error processing payment:', err);
    res.status(500).json({ error: 'Internal error processing payment' });
  }
});

export default router;
