import { CircleAgentWalletGuardrail } from '../skills/circle-arbisim-guard/policy_connector';

async function runCircleAgentDemo() {
  console.log(`
===============================================================
    ArbiSim Guard - Circle Agent Stack Pre-Flight Demo
===============================================================
`);

  // Initialize Circle Agent Wallet Guardrail Policy Connector
  const guardrail = new CircleAgentWalletGuardrail({
    endpoint: 'http://localhost:3000/api/v1',
    useX402Nanopayments: true,
    payerAddress: '0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1',
  });

  console.log('---------------------------------------------------------------');
  console.log(' [CASE 1] Pre-Flight Simulation: Circle Agent USDC Transfer');
  console.log('---------------------------------------------------------------');

  const usdcTxPayload = {
    walletId: 'circle_agent_wallet_prod_01',
    network: 'arbitrum-one',
    transaction: {
      from: '0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1',
      to: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC on Arbitrum
      data: '0xa9059cbb000000000000000000000000111111111111111111111111111111111111111100000000000000000000000000000000000000000000000000000000000f4240', // 1 USDC transfer
      value: '0x0',
    },
  };

  const result1 = await guardrail.evaluatePolicy(usdcTxPayload);
  console.log('>>> Result:');
  console.log(`Status: ${result1.approved ? '✅ APPROVED' : '❌ REJECTED'}`);
  console.log(`Policy ID: ${result1.policyId}`);
  console.log(`Session ID: ${result1.sessionId}`);
  console.log(`Reason: ${result1.reason}`);
  console.log('Telemetry:', JSON.stringify(result1.telemetry, null, 2));

  console.log('\n---------------------------------------------------------------');
  console.log(' [CASE 2] Pre-Flight Simulation: Excessive Gas Limit Violation');
  console.log('---------------------------------------------------------------');

  const highGasTxPayload = {
    walletId: 'circle_agent_wallet_prod_01',
    network: 'arbitrum-one',
    transaction: {
      from: '0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1',
      to: '0x0000000000000000000000000000000000000000',
      data: '0x',
      gasLimit: '0x989680', // 10,000,000 gas limit (exceeds safety policy)
    },
  };

  const result2 = await guardrail.evaluatePolicy(highGasTxPayload);
  console.log('>>> Result:');
  console.log(`Status: ${result2.approved ? '✅ APPROVED' : '❌ REJECTED'}`);
  console.log(`Reason: ${result2.reason}`);

  console.log(`
===============================================================
   Circle Agent Pre-Flight Simulation Verification Completed!
===============================================================
`);
}

runCircleAgentDemo();
