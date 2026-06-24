import { Router, Request, Response } from 'express';
import { isPaymentVerified, recordPayment, addCredits, getOrCreateUser } from '../db.js';
import { config } from '../config.js';

const router = Router();

/**
 * POST /api/v1/public/webhooks/nowpayments
 * Handles NOWPayments Instant Payment Notifications (IPN)
 */
router.post('/nowpayments', async (req: Request, res: Response): Promise<void> => {
  const signature = req.headers['x-nowpayments-sig'];
  
  if (!signature || typeof signature !== 'string') {
    console.error('NOWPayments Webhook: Missing signature header');
    res.status(400).json({ error: 'Missing signature header' });
    return;
  }

  try {
    const { NowPaymentsSDK } = await import('@nowpaymentsio/nowpayments-sdk-nodejs');
    const sdk = new NowPaymentsSDK({
      apiKey: process.env.NOWPAYMENTS_API_KEY || '',
      ipnSecret: process.env.NOWPAYMENTS_IPN_SECRET || '',
    });

    // 1. Verify signature and parse payload using SDK
    const event = sdk.parseWebhook(req.body, signature);
    
    if (event.type !== 'payment.status_changed') {
      console.log(`NOWPayments Webhook: Ignored event type: ${event.type}`);
      res.json({ ok: true });
      return;
    }

        const payment = event.payment;
    const paymentId = payment.payment_id;
    const orderId = payment.order_id;
    const rawStatus = payment.payment_status;
    const sdkStatus = payment.status;

    if (!paymentId) {
      console.error('NOWPayments Webhook: Missing payment_id in payment payload');
      res.status(400).json({ error: 'Missing payment_id in payment payload' });
      return;
    }

    console.log(`NOWPayments Webhook: Payment ID: ${paymentId}, Order ID: ${orderId}, Status: ${rawStatus} (SDK: ${sdkStatus})`);

    // We only process completed payments
    if (rawStatus === 'finished' || sdkStatus === 'paid') {
      if (!orderId) {
        console.error('NOWPayments Webhook: Missing order_id in payment');
        res.status(400).json({ error: 'Missing order_id in payment' });
        return;
      }

      // Order ID format: address:tier:timestamp
      const parts = orderId.split(':');
      if (parts.length < 2) {
        console.error(`NOWPayments Webhook: Invalid order_id format: ${orderId}`);
        res.status(400).json({ error: 'Invalid order_id format' });
        return;
      }

      // Determine if this is a credit pack purchase or a tier upgrade
      const isCreditPack = parts[0] === 'credit';

      if (isCreditPack) {
        // Credit pack order: credit:address:pack_id:timestamp
        const creditAddress = parts[1].toLowerCase();
        const packId = parts[2];

        const CREDIT_PACKS: Record<string, number> = {
          credit_500: 500,
          credit_2500: 2500,
          credit_10000: 10000,
        };

        const creditsToAdd = CREDIT_PACKS[packId];
        if (!creditsToAdd) {
          console.error(`NOWPayments Webhook: Unknown credit pack: ${packId}`);
          res.status(400).json({ error: 'Unknown credit pack' });
          return;
        }

        const payAmount = payment.pay_amount ? String(payment.pay_amount) : String(payment.price_amount || '0');
        await recordPayment(paymentId, creditAddress, `credit_${packId}`, payAmount);

        // Add credits to user
        await getOrCreateUser(creditAddress);
        await addCredits(creditAddress, creditsToAdd, 'purchase', `Purchased ${packId} credit pack`, paymentId);
        console.log(`NOWPayments Webhook: Added ${creditsToAdd} credits to ${creditAddress}`);
      } else {
        // Standard tier upgrade: address:tier:timestamp
        const address = parts[0].toLowerCase();
        const tier = parts[1].toLowerCase();

        console.log(`NOWPayments Webhook: Upgrade validated. Upgrading address: ${address} to tier: ${tier}`);

        const payAmount = payment.pay_amount ? String(payment.pay_amount) : String(payment.price_amount || '0');
        
        // 2. Record payment in database
        await recordPayment(paymentId, address, tier, payAmount);

        // 3. Sync upgraded tier to Cloudflare KV cache
        const workerUrl = (process.env.CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev').replace(/\/$/, '');
        const adminKey = config.api.adminKey;

        try {
          console.log(`NOWPayments Webhook: Syncing tier ${tier} to Cloudflare KV for user ${address}`);
          const syncResponse = await fetch(`${workerUrl}/api/v1/internal/update-tier`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Gateway-Secret': adminKey,
            },
            body: JSON.stringify({ address, tier }),
          });

          if (!syncResponse.ok) {
            const errMsg = await syncResponse.text();
            console.error(`NOWPayments Webhook: Failed to sync tier to Cloudflare Worker. Status: ${syncResponse.status}, Error: ${errMsg}`);
          } else {
            console.log(`NOWPayments Webhook: Successfully synced tier ${tier} to Cloudflare KV for user ${address}`);
          }
        } catch (syncErr) {
          console.error('NOWPayments Webhook: Exception during Cloudflare KV sync:', syncErr);
        }
      }
    }

    res.json({ ok: true });
  } catch (err: any) {
    console.error('NOWPayments Webhook: Signature verification or processing failed:', err);
    res.status(400).json({ error: 'Signature verification failed' });
  }
});

export default router;
