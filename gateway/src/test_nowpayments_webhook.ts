import express from 'express';
import { pgPool, initDb } from './db.js';
import nowPaymentsRouter from './routes/nowpayments.js';

// Setup environment variables for testing
process.env.NOWPAYMENTS_API_KEY = 'test_api_key';
process.env.NOWPAYMENTS_IPN_SECRET = 'test_ipn_secret';
process.env.CF_WORKER_URL = 'http://localhost:8787';
process.env.ADMIN_API_KEY = 'arbisim_admin_59f02798590e1274a926e468';

async function runTest() {
  console.log('=== NOWPayments Webhook Integration Test ===');

  // Initialize DB connection
  await initDb();

  // Setup express server just for the webhook route
  const app = express();
  app.use(express.json());
  app.use('/api/v1/public/webhooks', nowPaymentsRouter);

  const server = app.listen(0, async () => {
    const addressInfo = server.address() as any;
    const port = addressInfo.port;
    console.log(`Test server listening on port ${port}`);

    // Mock global fetch to intercept edge worker updates
    let syncCalled = false;
    let syncPayload: any = null;

    const originalFetch = global.fetch;
    global.fetch = (async (url: string, options: any) => {
      if (url.includes('/api/v1/internal/update-tier')) {
        syncCalled = true;
        syncPayload = JSON.parse(options.body);
        return {
          ok: true,
          status: 200,
          text: async () => 'OK',
          json: async () => ({ success: true }),
        } as any;
      }
      return originalFetch(url, options);
    }) as any;

    // Clear previous mock payment from DB to ensure clean run
    const testPaymentId = 'test_payment_9988';
    await pgPool.query('DELETE FROM verified_payments WHERE tx_hash = $1', [testPaymentId]);

    // Construct mock payload matching NOWPayments IPN format
    const mockPayload = {
      payment_id: testPaymentId,
      invoice_id: 'test_invoice_9988',
      payment_status: 'finished',
      pay_address: '0x1234567890123456789012345678901234567890',
      price_amount: 29,
      price_currency: 'usd',
      pay_amount: 0.009,
      actually_paid: 0.009,
      pay_currency: 'eth',
      order_id: '0x9ea8b065a624df44cab6c8cae74a22e07e29f2f1:builder:1718500000000',
      order_description: 'ArbiSim Guard Subscription: BUILDER Plan',
      purchase_id: 'test_purchase_9988',
      created_at: '2026-06-16T00:55:04.000Z',
      updated_at: '2026-06-16T00:55:04.000Z',
      outcome_amount: 29,
      outcome_currency: 'usdc'
    };

    // Calculate signature using the SDK function
    const { createWebhookSignature } = await import('@nowpaymentsio/nowpayments-sdk-nodejs');
    const signature = createWebhookSignature(mockPayload, process.env.NOWPAYMENTS_IPN_SECRET!);
    console.log(`Calculated signature: ${signature}`);

    // Send POST request to our test server
    try {
      const response = await originalFetch(`http://localhost:${port}/api/v1/public/webhooks/nowpayments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-nowpayments-sig': signature,
        },
        body: JSON.stringify(mockPayload),
      });

      console.log(`Response status: ${response.status}`);
      const resBody = (await response.json()) as any;
      console.log('Response body:', resBody);

      // Verify DB record
      const dbResult = await pgPool.query('SELECT * FROM verified_payments WHERE tx_hash = $1', [testPaymentId]);
      const dbRow = dbResult.rows[0];

      if (dbRow) {
        console.log('✅ DB Record Verified:', dbRow);
      } else {
        console.error('❌ DB Record missing!');
      }

      // Verify Cloudflare KV sync trigger
      if (syncCalled && syncPayload) {
        console.log('✅ Cloudflare Worker KV sync call triggered successfully!');
        console.log('KV Sync Payload:', syncPayload);
      } else {
        console.error('❌ Cloudflare Worker KV sync was not triggered!');
      }

      if (dbRow && syncCalled && resBody.ok === true) {
        console.log('\n=== TEST PASSED SUCCESSFULLY! ===');
      } else {
        console.error('\n=== TEST FAILED! ===');
      }

    } catch (err) {
      console.error('Test execution failed with error:', err);
    } finally {
      // Restore original fetch and close server
      global.fetch = originalFetch;
      server.close();
      await pgPool.end();
    }
  });
}

runTest();
