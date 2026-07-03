import { x402Middleware } from '../src/middleware/x402';

async function testX402Middleware() {
  console.log('=== Testing Circle x402 Agent Nanopayments Middleware ===');

  let statusSet = 0;
  let headersSet: Record<string, string> = {};
  let jsonSent: any = null;
  let nextCalled = false;

  const reqUnauth: any = {
    headers: {},
  };

  const resUnauth: any = {
    status: (s: number) => { statusSet = s; return resUnauth; },
    set: (h: Record<string, string>) => { headersSet = { ...headersSet, ...h }; return resUnauth; },
    setHeader: (name: string, val: string) => { headersSet[name] = val; return resUnauth; },
    getHeader: (name: string) => headersSet[name],
    json: (j: any) => { jsonSent = j; return resUnauth; },
  };

  await x402Middleware(reqUnauth, resUnauth, () => { nextCalled = true; });

  if (statusSet === 402 || headersSet['X-402-Payment-Required'] || headersSet['x-402-payment-required']) {
    console.log('✅ PASS: Unauthenticated request correctly received HTTP 402 Payment Required.');
    console.log(`   Headers set: ${JSON.stringify(headersSet)}`);
  } else {
    console.error('❌ FAIL: Expected 402 Payment Required response. Received status:', statusSet);
  }

  // Test 2: Request with valid x402 Payment Header
  nextCalled = false;
  const reqPaid: any = {
    headers: {
      'x-402-payment': 'x402 0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1:0.001:0x_test_sig',
    },
  };

  await x402Middleware(reqPaid, resUnauth, () => { nextCalled = true; });

  if (nextCalled && reqPaid.x402Payment?.verified) {
    console.log('✅ PASS: x402 Payment header successfully verified!');
    console.log(`   Payer: ${reqPaid.x402Payment.payerAddress}, Amount: ${reqPaid.x402Payment.amountUsdc} USDC`);
  } else {
    console.error('❌ FAIL: x402 Payment header verification failed.');
  }

  console.log('=== All x402 Middleware Tests Completed ===');
}

testX402Middleware();
