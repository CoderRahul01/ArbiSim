import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ethers } from 'ethers';
import { getSimulation, getMongoDb, updateSimulationStatusAndTelemetry, pgPool, listSimulations } from './db.js';
import { submitSimulationJob } from './queue.js';
import { MCP_TOOLS, callMcpTool } from './mcp-tools.js';
import { VALID_NETWORKS } from './chain-config.js';

export const router = Router();

const ENTRYPOINT_V06_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const ENTRYPOINT_V07_ADDRESS = '0x0000000071727De22E5E9d8BAf0edAc6f37da032';

// Minimal ABI representing ERC-4337 EntryPoints v0.6 & v0.7
const ENTRYPOINT_ABI = [
  // v0.6 simulateValidation
  {
    "inputs": [
      {
        "components": [
          { "name": "sender", "type": "address" },
          { "name": "nonce", "type": "uint256" },
          { "name": "initCode", "type": "bytes" },
          { "name": "callData", "type": "bytes" },
          { "name": "callGasLimit", "type": "uint256" },
          { "name": "verificationGasLimit", "type": "uint256" },
          { "name": "preVerificationGas", "type": "uint256" },
          { "name": "maxFeePerGas", "type": "uint256" },
          { "name": "maxPriorityFeePerGas", "type": "uint256" },
          { "name": "paymasterAndData", "type": "bytes" },
          { "name": "signature", "type": "bytes" }
        ],
        "name": "op",
        "type": "tuple"
      }
    ],
    "name": "simulateValidation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // v0.7 simulateValidation
  {
    "inputs": [
      {
        "components": [
          { "name": "sender", "type": "address" },
          { "name": "nonce", "type": "uint256" },
          { "name": "initCode", "type": "bytes" },
          { "name": "callData", "type": "bytes" },
          { "name": "accountGasLimits", "type": "bytes32" },
          { "name": "preVerificationGas", "type": "uint32" },
          { "name": "gasFees", "type": "bytes32" },
          { "name": "paymasterAndData", "type": "bytes" },
          { "name": "signature", "type": "bytes" }
        ],
        "name": "op",
        "type": "tuple"
      }
    ],
    "name": "simulateValidation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // Custom Errors
  {
    "inputs": [
      {
        "components": [
          { "name": "preOpGas", "type": "uint256" },
          { "name": "prefund", "type": "uint256" },
          { "name": "sigFailed", "type": "bool" },
          { "name": "validAfter", "type": "uint48" },
          { "name": "validUntil", "type": "uint48" },
          { "name": "paymasterContext", "type": "bytes" }
        ],
        "name": "returnInfo",
        "type": "tuple"
      },
      {
        "components": [
          { "name": "stake", "type": "uint256" },
          { "name": "unstakeDelaySec", "type": "uint256" }
        ],
        "name": "senderInfo",
        "type": "tuple"
      },
      {
        "components": [
          { "name": "stake", "type": "uint256" },
          { "name": "unstakeDelaySec", "type": "uint256" }
        ],
        "name": "factoryInfo",
        "type": "tuple"
      },
      {
        "components": [
          { "name": "stake", "type": "uint256" },
          { "name": "unstakeDelaySec", "type": "uint256" }
        ],
        "name": "paymasterInfo",
        "type": "tuple"
      }
    ],
    "name": "ValidationResult",
    "type": "error"
  },
  {
    "inputs": [
      { "name": "opIndex", "type": "uint256" },
      { "name": "reason", "type": "string" }
    ],
    "name": "FailedOp",
    "type": "error"
  }
];

/**
 * @openapi
 * /api/v1/simulate:
 *   post:
 *     summary: Submit a transaction batch or UserOperation for pre-flight simulation
 *     description: Submit EOA transactions or smart account UserOps to be simulated on isolated local forks of Arbitrum.
 */
router.post('/simulate', async (req: Request, res: Response): Promise<void> => {
  const { network, agent_address, transactions, max_slippage_tolerance, userOp, entrypointVersion } = req.body;

  // Validation
  if (!network || !VALID_NETWORKS.includes(network)) {
    res.status(400).json({ error: `Invalid 'network'. Supported: ${VALID_NETWORKS.join(', ')}` });
    return;
  }

  if (!agent_address || typeof agent_address !== 'string' || !agent_address.startsWith('0x')) {
    res.status(400).json({ error: "Invalid 'agent_address'. Must be a hexadecimal EVM address." });
    return;
  }

  // Determine if it is a UserOperation simulation payload
  const isUserOp = !!userOp;

  if (!isUserOp) {
    if (!Array.isArray(transactions) || transactions.length === 0) {
      res.status(400).json({ error: "Invalid 'transactions'. Must be a non-empty array when userOp is absent." });
      return;
    }

    for (let idx = 0; idx < transactions.length; idx++) {
      const tx = transactions[idx];
      if (!tx.to || !tx.data || tx.value === undefined) {
        res.status(400).json({ error: `Transaction at index ${idx} is missing 'to', 'data', or 'value'.` });
        return;
      }
    }
  } else {
    // Validate UserOperation fields
    if (!userOp.sender || !userOp.nonce || !userOp.callData || !userOp.signature) {
      res.status(400).json({ error: "UserOperation payload is missing required fields (sender, nonce, callData, signature)" });
      return;
    }
  }

  if (max_slippage_tolerance === undefined || typeof max_slippage_tolerance !== 'number') {
    res.status(400).json({ error: "Invalid 'max_slippage_tolerance'. Must be a number." });
    return;
  }

  try {
    const sessionId = uuidv4();
    
    // Package payload for queue
    const queuePayload = isUserOp ? {
      is_user_op: true,
      user_op: userOp,
      entrypoint_version: entrypointVersion || 'v0.6',
      network,
      agent_address,
      max_slippage_tolerance
    } : {
      is_user_op: false,
      transactions,
      network,
      agent_address,
      max_slippage_tolerance
    };

    const apiKeyId = (req as any).apiKeyId || null;
    // Submit simulation job
    await submitSimulationJob(
      sessionId,
      network,
      agent_address,
      isUserOp ? [] : transactions,
      max_slippage_tolerance,
      apiKeyId
    );

    // Update the PostgreSQL queue row with the full payload (ensures UserOp fields are present)
    await pgPool.query(
      `UPDATE simulation_queue SET payload = $1 WHERE session_id = $2`,
      [JSON.stringify(queuePayload), sessionId]
    );

    res.status(202).json({
      session_id: sessionId,
      status: 'PENDING',
    });
  } catch (error) {
    console.error('Failed to submit simulation job:', error);
    res.status(500).json({ error: 'Internal server error during simulation queuing.' });
  }
});

/**
 * POST /api/v1/simulate/x402
 * Dedicated x402 payment pre-flight simulation.
 * Builds a standard ERC-20 transfer job and queues it with simulation_type=x402_payment.
 */
router.post('/simulate/x402', async (req: Request, res: Response): Promise<void> => {
  const { network, from_address, to_address, token_address, amount_raw, erc8004_check = true } = req.body;

  if (!network || !VALID_NETWORKS.includes(network)) {
    res.status(400).json({ error: `Invalid 'network'. Supported: ${VALID_NETWORKS.join(', ')}` });
    return;
  }
  if (!from_address || !to_address || !token_address || !amount_raw) {
    res.status(400).json({ error: "Missing required fields: from_address, to_address, token_address, amount_raw" });
    return;
  }
  if (typeof amount_raw !== 'string' && typeof amount_raw !== 'number') {
    res.status(400).json({ error: "'amount_raw' must be a string or number (raw token units, no decimals)" });
    return;
  }

  let amountHex: string;
  try {
    amountHex = BigInt(amount_raw).toString(16).padStart(64, '0');
  } catch {
    res.status(400).json({ error: "'amount_raw' is not a valid integer" });
    return;
  }

  // Build ERC-20 transfer(address,uint256) calldata
  const transferData = `0xa9059cbb${to_address.replace(/^0x/i, '').toLowerCase().padStart(64, '0')}${amountHex}`;

  const transactions = [{
    to: token_address,
    data: transferData,
    value: '0',
    gas: '0x30D40',
  }];

  const sessionId = uuidv4();
  const queuePayload = {
    is_user_op: false,
    transactions,
    network,
    agent_address: from_address,
    max_slippage_tolerance: 0,
    metadata: {
      simulation_type: 'x402_payment',
      payee: to_address,
      token: token_address,
      amount_raw: String(amount_raw),
      erc8004_check,
    },
  };

  try {
    const apiKeyId = (req as any).apiKeyId ?? null;
    await submitSimulationJob(sessionId, network, from_address, transactions, 0, apiKeyId);
    await pgPool.query(
      `UPDATE simulation_queue SET payload = $1 WHERE session_id = $2`,
      [JSON.stringify(queuePayload), sessionId]
    );

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
    res.status(202).json({
      session_id: sessionId,
      simulation_type: 'x402_payment',
      status: 'PENDING',
      poll_url: `/api/v1/simulate/${sessionId}`,
      ...(appUrl && { explorer_url: `${appUrl}/sim/${sessionId}` }),
    });
  } catch (error) {
    console.error('Failed to submit x402 simulation job:', error);
    res.status(500).json({ error: 'Internal server error during x402 simulation queuing.' });
  }
});

/**
 * @openapi
 * /api/v1/simulate/{session_id}:
 *   get:
 *     summary: Retrieve simulation logs and computed telemetry
 */
router.get('/simulate/:session_id', async (req: Request, res: Response): Promise<void> => {
  const { session_id } = req.params;

  try {
    // 1. Fetch from NeonDB/Postgres
    const pgRecord = await getSimulation(session_id);
    if (!pgRecord) {
      res.status(404).json({ error: `Simulation session ${session_id} not found.` });
      return;
    }

    // 2. Fetch telemetry details from MongoDB with PG fallback
    let mongoRecord = null;
    try {
      const mongoDb = getMongoDb();
      mongoRecord = await mongoDb.collection('telemetry').findOne({ session_id });
    } catch (err) {
      console.warn(`MongoDB not accessible: ${err}. Falling back to PostgreSQL telemetry.`);
    }

    const telemetry = mongoRecord || pgRecord.telemetry;

    // Parse slippage string "2.34%" → 2.34
    const slippagePct = telemetry?.slippage_detected
      ? parseFloat(telemetry.slippage_detected)
      : undefined;

    // Synthesize flags from telemetry so the dashboard can display them
    const chainExtras = telemetry?.chain_extras ?? {};
    const flags: Record<string, boolean | string | number | null> | null = telemetry ? {
      execution_reverted: !!(telemetry.revert_reason),
      high_slippage: !isNaN(slippagePct as number) && (slippagePct as number) > 2,
      sandwich_detected: (telemetry.timeboost_mev_telemetry?.mev_sandwich_risk_score ?? 0) > 0.5,
      unsafe_allowance: false,
      sig_failed: typeof telemetry.revert_reason === 'string' && telemetry.revert_reason.includes('sigFailed'),
      valid_until_expired: typeof telemetry.revert_reason === 'string' && telemetry.revert_reason.includes('expired'),
      timeboost_recommended: !!(telemetry.timeboost_mev_telemetry?.timeboost_fastlane_recommended),
      stylus_ink_overflow: (telemetry.stylus_ink_consumed ?? 0) > 100_000_000,
      // Avalanche-specific flags (present when chain_extras populated)
      low_agent_reputation: !!(chainExtras.low_agent_reputation),
      x402_payment_risk: !!(chainExtras.x402_payment_risk),
    } : null;

    // 3. Fetch original queue payload
    const queueRes = await pgPool.query(
      'SELECT payload FROM simulation_queue WHERE session_id = $1 LIMIT 1',
      [session_id]
    );
    const payload = queueRes.rows[0]?.payload ?? null;

    res.status(200).json({
      sessionId: pgRecord.session_id,
      session_id: pgRecord.session_id,
      status: pgRecord.status,
      network: pgRecord.network,
      agent_address: pgRecord.agent_address,
      created_at: pgRecord.created_at,
      updated_at: pgRecord.updated_at,
      revertReason: telemetry?.revert_reason ?? null,
      gasCostEth: telemetry?.gas_cost_eth,
      netPnlUsd: telemetry?.net_pnl_usd,
      slippagePercent: slippagePct !== undefined && !isNaN(slippagePct) ? slippagePct : undefined,
      stylusInkConsumed: telemetry?.stylus_ink_consumed,
      flags,
      gasBreakdown: telemetry?.gas_breakdown ?? undefined,
      timeboost: telemetry?.timeboost_mev_telemetry ?? undefined,
      balanceTraces: telemetry?.balance_traces ?? [],
      tokenTransfers: telemetry?.token_transfers ?? [],
      executionTraces: telemetry?.execution_traces ?? [],
      payload,
    });
  } catch (error) {
    console.error(`Failed to fetch simulation status for session ${session_id}:`, error);
    res.status(500).json({ error: 'Internal server error during simulation lookup.' });
  }
});

/**
 * @openapi
 * /api/v1/stats:
 *   get:
 *     summary: Usage statistics for the authenticated API key
 */
router.get('/stats', async (_req: Request, res: Response): Promise<void> => {
  try {
    const [simResult, overviewResult] = await Promise.all([
      pgPool.query(`
        SELECT
          COUNT(*)                                                               AS total,
          COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE)               AS today,
          COUNT(*) FILTER (WHERE created_at >= date_trunc('month', now()))       AS month,
          COUNT(*) FILTER (WHERE status = 'APPROVED'
                             AND created_at >= date_trunc('month', now()))       AS approved,
          COUNT(*) FILTER (WHERE status IN ('APPROVED','REJECTED')
                             AND created_at >= date_trunc('month', now()))       AS terminal
        FROM simulations
      `),
      pgPool.query(`
        SELECT
          COUNT(DISTINCT owner_email)                                                         AS total_users,
          (SELECT COUNT(DISTINCT user_address) FROM verified_payments)                        AS paid_users,
          COALESCE((SELECT SUM(amount::numeric) FROM verified_payments), 0)                   AS revenue_usdc
        FROM api_keys
        WHERE revoked_at IS NULL
      `),
    ]);

    const row = simResult.rows[0];
    const ov  = overviewResult.rows[0];
    const terminal  = Number(row.terminal);
    const approved  = Number(row.approved);
    const approval_rate = terminal > 0 ? Math.round((approved / terminal) * 100) : null;

    res.json({
      today:         Number(row.today),
      month:         Number(row.month),
      total:         Number(row.total),
      approval_rate,
      quota_used:    Number(row.month),
      quota_limit:   500,
      total_users:   Number(ov.total_users),
      paid_users:    Number(ov.paid_users),
      revenue_usdc:  Number(ov.revenue_usdc).toFixed(2),
    });
  } catch (error) {
    console.error('Stats query failed:', error);
    res.status(500).json({ error: 'Failed to fetch stats.' });
  }
});

/**
 * Internal route called by workers to simulate ERC-4337 validation logic using state overrides.
 */
router.post('/validate-userop', async (req: Request, res: Response): Promise<void> => {
  const { rpc_url, user_op, entrypoint_version, session_id } = req.body;
  
  if (!rpc_url || !user_op || !entrypoint_version || !session_id) {
    res.status(400).json({ error: "Missing required fields: rpc_url, user_op, entrypoint_version, session_id" });
    return;
  }

  const entryPointAddress = entrypoint_version === 'v0.7' ? ENTRYPOINT_V07_ADDRESS : ENTRYPOINT_V06_ADDRESS;
  console.log(`Running EntryPoint ${entrypoint_version} AA Validation against fork: ${rpc_url}`);

  try {
    const provider = new ethers.JsonRpcProvider(rpc_url);
    
    // 1. Impersonate the EntryPoint contract
    try {
      await provider.send('anvil_impersonateAccount', [entryPointAddress]);
      await provider.send('anvil_setBalance', [entryPointAddress, '0x56BC75E2D63100000']); // 100 ETH
    } catch (err) {
      console.warn("Impersonation warning (node might not support anvil RPCs):", err);
    }

    // 2. State override set (can override code/balance for execution runtime sandbox)
    const stateOverrideSet = {
      // Direct pass
    };

    // Encode simulateValidation
    const entryPointInterface = new ethers.Interface(ENTRYPOINT_ABI);
    const functionSignature = entrypoint_version === 'v0.7'
      ? 'simulateValidation((address,uint256,bytes,bytes,bytes32,uint32,bytes32,bytes,bytes))'
      : 'simulateValidation((address,uint256,bytes,bytes,uint256,uint256,uint256,uint256,uint256,bytes,bytes))';
    const encodedData = entryPointInterface.encodeFunctionData(functionSignature, [user_op]);

    const txParams = {
      to: entryPointAddress,
      data: encodedData,
    };

    let validationRevertData: string | null = null;
    
    try {
      // Execute call with State Override Set
      await provider.send('eth_call', [txParams, 'latest', stateOverrideSet]);
    } catch (err: any) {
      // Capture revert hex from error body
      validationRevertData = err.data || err.error?.data || (err.info && err.info.error && err.info.error.data) || err.message;
      if (typeof validationRevertData === 'string' && validationRevertData.includes('0x')) {
        const matches = validationRevertData.match(/0x[a-fA-F0-9]+/);
        if (matches) {
          validationRevertData = matches[0];
        }
      }
    }

    if (!validationRevertData) {
      res.status(400).json({ error: "simulateValidation completed without returning revert error." });
      return;
    }

    // 3. Decode EntryPoint ValidationResult custom error
    try {
      const parsedError = entryPointInterface.parseError(validationRevertData);
      
      if (parsedError && parsedError.name === 'ValidationResult') {
        const returnInfo = parsedError.args[0]; // Struct containing sigFailed and validUntil
        const sigFailed = returnInfo[2]; // sigFailed index
        const validUntil = Number(returnInfo[4]); // validUntil index

        // sigFailed guardrail validation
        if (sigFailed) {
          await updateSimulationStatusAndTelemetry(session_id, 'REJECTED', {
            status: 'REJECTED',
            revert_reason: 'ZeroDev UserOperation signature validation failed (sigFailed: true).'
          });
          res.json({ success: false, reason: "ZeroDev UserOperation signature validation failed." });
          return;
        }

        // Session key expiration check
        const currentBlock = await provider.getBlock('latest');
        const blockTimestamp = currentBlock ? currentBlock.timestamp : Math.floor(Date.now() / 1000);
        
        if (validUntil !== 0 && blockTimestamp > validUntil) {
          await updateSimulationStatusAndTelemetry(session_id, 'REJECTED', {
            status: 'REJECTED',
            revert_reason: `ZeroDev UserOperation session key expired. blockTimestamp ${blockTimestamp} > validUntil ${validUntil}.`
          });
          res.json({ success: false, reason: `UserOperation expired. blockTime: ${blockTimestamp}, validUntil: ${validUntil}` });
          return;
        }

        // Validation passed
        res.json({ success: true, returnInfo: { sigFailed, validUntil } });
        return;
      } else if (parsedError && parsedError.name === 'FailedOp') {
        const reason = parsedError.args[1];
        await updateSimulationStatusAndTelemetry(session_id, 'REJECTED', {
          status: 'REJECTED',
          revert_reason: `EntryPoint FailedOp: ${reason}`
        });
        res.json({ success: false, reason: `FailedOp: ${reason}` });
        return;
      }
    } catch (decodeErr) {
      console.warn("Could not decode custom validation error directly:", decodeErr);
    }

    res.json({ success: true, warning: "Validation check finished without definitive custom error." });

  } catch (err: any) {
    console.error("AA validation loop exception:", err);
    await updateSimulationStatusAndTelemetry(session_id, 'REJECTED', {
      status: 'REJECTED',
      revert_reason: `AA simulation exception: ${err.message}`
    });
    res.status(500).json({ error: `UserOperation simulation exception: ${err.message}` });
  } finally {
    // Teardown impersonation
    try {
      const provider = new ethers.JsonRpcProvider(rpc_url);
      await provider.send('anvil_stopImpersonatingAccount', [entryPointAddress]);
    } catch (e) {}
  }
});

// ── MCP HTTP Bridge ─────────────────────────────────────────────────────────
// POST /api/v1/mcp — JSON-RPC 2.0 over HTTP for the in-browser MCP playground.
// Handles tools/list and tools/call. Auth via requireAuth (applied at mount point).
router.post('/mcp', async (req: Request, res: Response): Promise<void> => {
  const { jsonrpc, id, method, params } = req.body ?? {};

  if (jsonrpc !== '2.0' || !method) {
    res.status(400).json({ jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'Invalid JSON-RPC request' } });
    return;
  }

  if (method === 'tools/list') {
    res.json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });
    return;
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = (params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    if (!name) {
      res.status(400).json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'params.name is required' } });
      return;
    }
    const apiKeyId = (req as any).apiKeyId as string | undefined;
    const { result, error } = await callMcpTool(name, args ?? {}, apiKeyId);
    if (error) {
      res.json({ jsonrpc: '2.0', id, error });
      return;
    }
    res.json({ jsonrpc: '2.0', id, result });
    return;
  }

  res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });
});

// ── Public (unauthenticated) routes ─────────────────────────────────────────
export const publicRouter = Router();

/**
 * @openapi
 * /api/v1/sim/public/{sessionId}:
 *   get:
 *     summary: Public read-only simulation result (no auth required)
 */
publicRouter.get('/public/:sessionId', async (req: Request, res: Response): Promise<void> => {
  const { sessionId } = req.params;

  try {
    const pgRecord = await getSimulation(sessionId);
    if (!pgRecord || !['APPROVED', 'REJECTED'].includes(pgRecord.status)) {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Simulation not found or not yet complete.' } });
      return;
    }

    // Fetch telemetry from MongoDB with PG fallback (same pattern as authenticated route)
    let mongoRecord = null;
    try {
      const mongoDb = getMongoDb();
      mongoRecord = await mongoDb.collection('telemetry').findOne({ session_id: sessionId });
    } catch {
      // Suppress — fallback to PG
    }

    const telemetry = mongoRecord || pgRecord.telemetry;

    const slippagePct = telemetry?.slippage_detected
      ? parseFloat(telemetry.slippage_detected)
      : undefined;

    const chainExtrasPublic = telemetry?.chain_extras ?? {};
    const flags: Record<string, boolean | null> | null = telemetry ? {
      execution_reverted: !!(telemetry.revert_reason),
      high_slippage: !isNaN(slippagePct as number) && (slippagePct as number) > 2,
      sandwich_detected: (telemetry.timeboost_mev_telemetry?.mev_sandwich_risk_score ?? 0) > 0.5,
      unsafe_allowance: false,
      sig_failed: typeof telemetry.revert_reason === 'string' && telemetry.revert_reason.includes('sigFailed'),
      valid_until_expired: typeof telemetry.revert_reason === 'string' && telemetry.revert_reason.includes('expired'),
      timeboost_recommended: !!(telemetry.timeboost_mev_telemetry?.timeboost_fastlane_recommended),
      stylus_ink_overflow: (telemetry.stylus_ink_consumed ?? 0) > 100_000_000,
      low_agent_reputation: !!(chainExtrasPublic.low_agent_reputation),
      x402_payment_risk: !!(chainExtrasPublic.x402_payment_risk),
    } : null;

    // Return sanitised result — no API key info, no owner details
    res.json({
      session_id: pgRecord.session_id,
      network: pgRecord.network,
      status: pgRecord.status,
      agent_address: pgRecord.agent_address,
      created_at: pgRecord.created_at,
      gasCostEth: telemetry?.gas_cost_eth,
      netPnlUsd: telemetry?.net_pnl_usd,
      slippagePercent: slippagePct !== undefined && !isNaN(slippagePct) ? slippagePct : undefined,
      stylusInkConsumed: telemetry?.stylus_ink_consumed,
      revertReason: telemetry?.revert_reason ?? null,
      flags,
      gasBreakdown: telemetry?.gas_breakdown ?? undefined,
      timeboost: telemetry?.timeboost_mev_telemetry ?? undefined,
    });
  } catch (error) {
    console.error(`Public sim lookup failed for ${sessionId}:`, error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch simulation.' } });
  }
});

/**
 * @openapi
 * /api/v1/logs:
 *   get:
 *     summary: Retrieve history of simulation API calls for the authenticated key
 */
router.get('/logs', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeyId = (req as any).apiKeyId;
    if (!apiKeyId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key is required.' } });
      return;
    }

    const { status, network, limit = '50', offset = '0', from, to } = req.query;

    const parsedLimit = parseInt(String(limit), 10);
    const parsedOffset = parseInt(String(offset), 10);
    const parsedFrom = from ? new Date(String(from)) : undefined;
    const parsedTo = to ? new Date(String(to)) : undefined;

    const result = await listSimulations(apiKeyId, {
      status: status ? String(status) : undefined,
      network: network ? String(network) : undefined,
      limit: parsedLimit,
      offset: parsedOffset,
      from: parsedFrom,
      to: parsedTo,
    });

    res.json({
      simulations: result.rows,
      total: result.total,
      has_more: parsedOffset + result.rows.length < result.total,
    });
  } catch (error) {
    console.error('Failed to list simulation logs:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch logs.' } });
  }
});

/**
 * @openapi
 * /api/v1/analytics:
 *   get:
 *     summary: Risk analytics dashboard data
 */
router.get('/analytics', async (req: Request, res: Response): Promise<void> => {
  try {
    const apiKeyId = (req as any).apiKeyId;
    if (!apiKeyId) {
      res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'API key is required.' } });
      return;
    }

    const days = parseInt(String(req.query.period ?? '30'), 10);

    // Query 1: per-day counts (30-day approval rate trend)
    const countsRes = await pgPool.query(
      `SELECT DATE(created_at) as date, status, COUNT(*)::integer as count 
       FROM simulations
       WHERE created_at >= NOW() - ($2 * INTERVAL '1 day') AND api_key_id = $1
       GROUP BY 1, 2 ORDER BY 1`,
      [apiKeyId, days]
    );

    // Query 2: rejection reasons from telemetry JSONB
    const reasonsRes = await pgPool.query(
      `SELECT COALESCE(telemetry->>'revert_reason', 'Unknown Revert') as reason, COUNT(*)::integer as count 
       FROM simulations
       WHERE status = 'REJECTED' AND api_key_id = $1 AND created_at >= NOW() - ($2 * INTERVAL '1 day')
       GROUP BY 1 ORDER BY count DESC LIMIT 10`,
      [apiKeyId, days]
    );

    // Query 3: average gas cost per day
    const gasRes = await pgPool.query(
      `SELECT DATE(created_at) as date, AVG(COALESCE((telemetry->>'gas_cost_eth')::numeric, 0))::numeric as avg_gas
       FROM simulations 
       WHERE api_key_id = $1 AND created_at >= NOW() - ($2 * INTERVAL '1 day')
       GROUP BY 1 ORDER BY 1`,
      [apiKeyId, days]
    );

    // Query 4: backtests summary
    const backtestRes = await pgPool.query(
      `SELECT COUNT(*)::integer as total, AVG(COALESCE((results->>'total_pnl_usd')::numeric, 0))::numeric as avg_pnl
       FROM backtests
       WHERE api_key_id = $1 AND status = 'COMPLETED'`,
      [apiKeyId]
    );

    res.json({
      daily_buckets: countsRes.rows,
      rejection_reasons: reasonsRes.rows,
      gas_stats: gasRes.rows,
      backtest_summary: {
        total: parseInt(backtestRes.rows[0]?.total ?? '0', 10),
        avg_pnl: parseFloat(backtestRes.rows[0]?.avg_pnl ?? '0'),
      }
    });
  } catch (error) {
    console.error('Failed to query analytics:', error);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics.' } });
  }
});

