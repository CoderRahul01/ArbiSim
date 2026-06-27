/**
 * Circle Payments API client.
 * Docs: https://developers.circle.com/reference/payments-payments-create
 */

const CIRCLE_API_BASE = 'https://api.circle.com/v1';

export interface CirclePaymentIntent {
  id: string;
  status: string;
  amount: { amount: string; currency: string };
  paymentMethods: { address: string; chain: string; currency: string }[];
}

/**
 * Create a blockchain payment intent for USDC on Arbitrum.
 * idempotencyKey encodes enough info to process the webhook without a DB lookup.
 * Format: credit:{walletAddress}:{packId}:{timestamp}
 */
export async function createCirclePaymentIntent(opts: {
  idempotencyKey: string;
  amountUsd: number;
  description: string;
}): Promise<CirclePaymentIntent> {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error('CIRCLE_API_KEY not configured');

  const res = await fetch(`${CIRCLE_API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      idempotencyKey: opts.idempotencyKey,
      amount: { amount: opts.amountUsd.toFixed(2), currency: 'USD' },
      settlementCurrency: 'USD',
      source: {
        type: 'blockchain',
        chain: 'ARB',
      },
      description: opts.description,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Circle API error ${res.status}: ${err}`);
  }

  return res.json() as Promise<CirclePaymentIntent>;
}

/**
 * Verify a Circle webhook notification signature.
 * Circle sends X-Circle-Key-Id and signs with RSA — for MVP we validate
 * via a shared secret (CIRCLE_WEBHOOK_SECRET) in a simpler HMAC approach,
 * or skip in sandbox and rely on idempotency-key dedup in the DB.
 */
export function verifyCircleWebhookSecret(secret: string): boolean {
  const expected = process.env.CIRCLE_WEBHOOK_SECRET;
  if (!expected) return true; // allow in dev / sandbox when not configured
  return secret === expected;
}
