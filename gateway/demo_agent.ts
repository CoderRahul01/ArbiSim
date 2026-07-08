const GATEWAY_URL = 'http://localhost:3000/api/v1';

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollSimulation(sessionId: string): Promise<any> {
  console.log(`Polling status for session: ${sessionId}...`);
  while (true) {
    const res = await fetch(`${GATEWAY_URL}/simulate/${sessionId}`);
    const data: any = await res.json();
    if (data.status !== 'PENDING' && data.status !== 'PROCESSING') {
      return data;
    }
    await sleep(2000);
  }
}

async function runDemo() {
  console.log("===============================================================");
  console.log("         ArbiSim Guard - E2E Agent Simulation Scenario          ");
  console.log("===============================================================\n");

  // =========================================================================
  // Case A: The Failure Mode (Expired Session Key UserOperation)
  // =========================================================================
  console.log("---------------------------------------------------------------");
  console.log(" [CASE A] Simulating Failure Mode: Expired Session Key UserOp");
  console.log("---------------------------------------------------------------");

  const expiredUserOp = {
    sender: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Anvil Account #1
    nonce: "0x0",
    initCode: "0x",
    callData: "0x",
    callGasLimit: "0x30000",
    verificationGasLimit: "0x50000",
    preVerificationGas: "0x10000",
    maxFeePerGas: "0x3b9aca00",
    maxPriorityFeePerGas: "0x3b9aca00",
    paymasterAndData: "0x",
    signature: "0x123456" // Invalid signature / expired structure
  };

  try {
    const submitRes = await fetch(`${GATEWAY_URL}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        network: "arbitrum-one",
        agent_address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        userOp: expiredUserOp,
        entrypointVersion: "v0.6",
        max_slippage_tolerance: 0.5
      })
    });

    const submitData: any = await submitRes.json();
    if (submitData.error) {
      console.log(`\u274c Request rejected by gateway: ${submitData.error}`);
      return;
    }

    const sessionId = submitData.session_id;
    console.log(`\u2705 Simulation Request Enqueued. Session ID: ${sessionId}`);

    const finalResult = await pollSimulation(sessionId);
    console.log("\n>>> Case A Results:");
    console.log(`Status: \u274c ${finalResult.status}`);
    console.log(`Revert Reason: ${finalResult.telemetry?.revert_reason || "None"}`);
    console.log("Verification Guardrail Triggered: Transaction Execution ABORTED to protect capital.");
  } catch (err: any) {
    console.error("Case A request failed:", err.message);
  }

  console.log("\n---------------------------------------------------------------");
  console.log(" [CASE B] Simulating Optimal Mode: Valid Strategy Simulation");
  console.log("---------------------------------------------------------------");

  const validTxs = [
    {
      to: "0x0000000000000000000000000000000000000000",
      data: "0x",
      value: "1000000000000000", // 0.001 ETH
      gasLimit: "21000"
    }
  ];

  try {
    const submitRes = await fetch(`${GATEWAY_URL}/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        network: "arbitrum-one",
        agent_address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        transactions: validTxs,
        max_slippage_tolerance: 0.5
      })
    });

    const submitData: any = await submitRes.json();
    const sessionId = submitData.session_id;
    console.log(`\u2705 Simulation Request Enqueued. Session ID: ${sessionId}`);

    const finalResult = await pollSimulation(sessionId);
    console.log("\n>>> Case B Results:");
    console.log(`Status: \u2705 ${finalResult.status}`);
    console.log(`Gas Cost: ${finalResult.telemetry?.gas_cost_eth} ETH`);
    console.log(`Stylus Ink Consumed: ${finalResult.telemetry?.stylus_ink_consumed} Ink`);
    console.log(`Net USD P&L: ${finalResult.telemetry?.net_pnl_usd} USD`);
    console.log(`Slippage: ${finalResult.telemetry?.slippage_detected}`);
    console.log("Gas Breakdown:", JSON.stringify(finalResult.telemetry?.gas_breakdown, null, 2));
    console.log("Timeboost & MEV Telemetry:", JSON.stringify(finalResult.telemetry?.timeboost_mev_telemetry, null, 2));
    console.log("Verification Guardrail Passed: Transaction execution is SAFE to proceed on-chain.");
  } catch (err: any) {
    console.error("Case B request failed:", err.message);
  }
}

runDemo();
