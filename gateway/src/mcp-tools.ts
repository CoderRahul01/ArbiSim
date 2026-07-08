/**
 * mcp-tools.ts
 * Shared MCP tool definitions and execution logic used by both:
 *  - StdioServerTransport (index.ts, --mcp flag)
 *  - POST /api/v1/mcp HTTP bridge (routes.ts)
 */

import { v4 as uuidv4 } from 'uuid';
import { getSimulation, getMongoDb, createBacktest, getBacktest } from './db.js';
import { submitSimulationJob } from './queue.js';
import { VALID_NETWORKS } from './chain-config.js';

// ── Tool definitions ────────────────────────────────────────────────────────

export const MCP_TOOLS = [
  {
    name: 'preflight_simulate',
    description: 'Submit a transaction batch for pre-flight simulation on isolated ephemeral Anvil forks. Returns a session_id to poll for results.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: VALID_NETWORKS,
          description: 'Target blockchain network',
        },
        agent_address: {
          type: 'string',
          description: 'Hexadecimal EVM wallet address of the agent (starts with 0x)',
        },
        transactions: {
          type: 'array',
          description: 'Ordered array of transactions to execute',
          items: {
            type: 'object',
            properties: {
              to:       { type: 'string', description: 'Hex target contract or receiver address' },
              data:     { type: 'string', description: 'Hex call data' },
              value:    { type: 'string', description: 'Value in Wei as string' },
              gasLimit: { type: 'string', description: 'Optional gas limit override' },
            },
            required: ['to', 'data', 'value'],
          },
        },
        max_slippage_tolerance: {
          type: 'number',
          description: 'Max slippage percentage (e.g. 0.5 for 0.5%)',
        },
      },
      required: ['network', 'agent_address', 'transactions', 'max_slippage_tolerance'],
    },
  },
  {
    name: 'get_simulation_status',
    description: 'Retrieve current status and metrics for a simulation session. Poll until status is APPROVED or REJECTED.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: {
          type: 'string',
          description: 'UUID session ID returned by preflight_simulate',
        },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'backtest_strategy',
    description: 'Replay a transaction strategy across a historical Arbitrum block range through ephemeral Anvil forks. Returns equity curve, Sharpe ratio, max drawdown, win rate, and profit factor.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['arbitrum-one', 'arbitrum-sepolia'],
          description: 'Target blockchain network (mainnet or testnet)',
        },
        agent_address: {
          type: 'string',
          description: 'Hexadecimal EVM wallet address of the agent',
        },
        block_start: {
          type: 'number',
          description: 'Starting block number (inclusive)',
        },
        block_end: {
          type: 'number',
          description: 'Ending block number (inclusive)',
        },
        block_stride: {
          type: 'number',
          description: 'Step size between sampled blocks (default: 100)',
        },
        strategy: {
          type: 'object',
          description: 'Transaction template to replay at each block',
          properties: {
            transactions:  { type: 'array',  description: 'Same transaction array as preflight_simulate' },
            max_slippage:  { type: 'number', description: 'Max slippage tolerance (%)' },
          },
          required: ['transactions'],
        },
      },
      required: ['network', 'agent_address', 'block_start', 'block_end', 'strategy'],
    },
  },
  {
    name: 'get_backtest_results',
    description: 'Retrieve results for a submitted backtest job. Poll until status is COMPLETED or FAILED.',
    inputSchema: {
      type: 'object',
      properties: {
        backtest_id: {
          type: 'string',
          description: 'UUID backtest ID returned by backtest_strategy',
        },
      },
      required: ['backtest_id'],
    },
  },
  {
    name: 'x402_preflight',
    description: 'Simulate an x402 payment before it fires. Forks the target chain, executes the ERC-20 transfer, and checks the payee\'s ERC-8004 on-chain reputation. Returns a session_id — poll get_simulation_status for the full safety verdict including FLAG_LOW_AGENT_REPUTATION and FLAG_X402_PAYMENT_RISK.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: VALID_NETWORKS,
          description: 'Target chain for the payment (e.g. avalanche-fuji)',
        },
        from_address: {
          type: 'string',
          description: 'Agent wallet address making the payment (0x...)',
        },
        to_address: {
          type: 'string',
          description: 'Payee address receiving the x402 payment (0x...)',
        },
        token_address: {
          type: 'string',
          description: 'ERC-20 token contract address (e.g. USDC on Fuji)',
        },
        amount_raw: {
          type: 'string',
          description: 'Raw token amount without decimals (e.g. "1000000" for 1 USDC)',
        },
        erc8004_check: {
          type: 'boolean',
          default: true,
          description: 'Whether to query ERC-8004 reputation for the payee (default: true)',
        },
      },
      required: ['network', 'from_address', 'to_address', 'token_address', 'amount_raw'],
    },
  },
];

// ── Tool execution ──────────────────────────────────────────────────────────

export async function callMcpTool(
  name: string,
  args: Record<string, unknown>,
  apiKeyId?: string
): Promise<{ result?: unknown; error?: { code: number; message: string } }> {

  if (name === 'preflight_simulate') {
    const { network, agent_address, transactions, max_slippage_tolerance } = args as any;
    if (!network || !agent_address || !transactions || max_slippage_tolerance === undefined) {
      return { error: { code: -32602, message: 'Missing required parameters' } };
    }
    try {
      const sessionId = uuidv4();
      await submitSimulationJob(sessionId, network, agent_address, transactions, max_slippage_tolerance);
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://arbisim-guard.vercel.app';
      return {
        result: {
          session_id: sessionId,
          status: '202 Accepted',
          message: 'Simulation queued. Poll get_simulation_status with this session_id.',
          trust_url: `${SITE_URL}/trust/${sessionId}`,
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Failed to queue simulation: ${err.message}` } };
    }
  }

  if (name === 'get_simulation_status') {
    const { session_id } = args as any;
    if (!session_id) return { error: { code: -32602, message: 'session_id is required' } };
    try {
      const pgRecord = await getSimulation(session_id);
      if (!pgRecord) return { error: { code: -32602, message: `Session ${session_id} not found` } };

      let mongoRecord: any = null;
      try {
        mongoRecord = await getMongoDb().collection('telemetry').findOne({ session_id });
      } catch {}

      const telemetry = mongoRecord || pgRecord.telemetry;
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://arbisim-guard.vercel.app';
      return {
        result: {
          session_id: pgRecord.session_id,
          network: pgRecord.network,
          agent_address: pgRecord.agent_address,
          status: pgRecord.status,
          trust_url: `${SITE_URL}/trust/${pgRecord.session_id}`,
          created_at: pgRecord.created_at,
          updated_at: pgRecord.updated_at,
          telemetry: telemetry ? {
            status: telemetry.status,
            gas_cost_eth: telemetry.gas_cost_eth,
            stylus_ink_consumed: telemetry.stylus_ink_consumed,
            net_pnl_usd: telemetry.net_pnl_usd,
            slippage_detected: telemetry.slippage_detected,
            revert_reason: telemetry.revert_reason,
            balance_traces: telemetry.balance_traces,
            token_transfers: telemetry.token_transfers,
            gas_breakdown: telemetry.gas_breakdown,
          } : null,
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Error fetching simulation: ${err.message}` } };
    }
  }

  if (name === 'backtest_strategy') {
    const { network, agent_address, block_start, block_end, block_stride = 100, strategy } = args as any;
    if (!network || !agent_address || block_start === undefined || block_end === undefined || !strategy?.transactions) {
      return { error: { code: -32602, message: 'Missing required parameters' } };
    }
    const totalSamples = Math.ceil((block_end - block_start) / block_stride);
    if (block_end <= block_start) return { error: { code: -32602, message: 'block_end must be greater than block_start' } };
    if (totalSamples > 5000) return { error: { code: -32602, message: `Total samples (${totalSamples}) exceeds maximum of 5000` } };
    try {
      const row = await createBacktest(apiKeyId ?? null, network, agent_address, strategy, block_start, block_end, block_stride);
      return {
        result: {
          backtest_id: row.id,
          status: 'PENDING',
          total_samples: totalSamples,
          message: 'Backtest queued. Poll get_backtest_results with this backtest_id.',
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Failed to queue backtest: ${err.message}` } };
    }
  }

  if (name === 'get_backtest_results') {
    const { backtest_id } = args as any;
    if (!backtest_id) return { error: { code: -32602, message: 'backtest_id is required' } };
    try {
      const row = await getBacktest(backtest_id);
      if (!row) return { error: { code: -32602, message: `Backtest ${backtest_id} not found` } };
      return {
        result: {
          backtest_id: row.id,
          status: row.status,
          network: row.network,
          block_start: row.block_start,
          block_end: row.block_end,
          block_stride: row.block_stride,
          results: row.results ?? null,
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Error fetching backtest: ${err.message}` } };
    }
  }

  if (name === 'x402_preflight') {
    const { network, from_address, to_address, token_address, amount_raw, erc8004_check = true } = args as any;
    if (!network || !from_address || !to_address || !token_address || !amount_raw) {
      return { error: { code: -32602, message: 'Missing required parameters: network, from_address, to_address, token_address, amount_raw' } };
    }
    if (!VALID_NETWORKS.includes(network)) {
      return { error: { code: -32602, message: `Invalid network. Supported: ${VALID_NETWORKS.join(', ')}` } };
    }

    let amountHex: string;
    try {
      amountHex = BigInt(amount_raw).toString(16).padStart(64, '0');
    } catch {
      return { error: { code: -32602, message: "'amount_raw' must be a valid integer string" } };
    }

    const transferData = `0xa9059cbb${String(to_address).replace(/^0x/i, '').toLowerCase().padStart(64, '0')}${amountHex}`;
    const transactions = [{ to: token_address, data: transferData, value: '0', gas: '0x30D40' }];

    try {
      const sessionId = uuidv4();
      await submitSimulationJob(sessionId, network, from_address, transactions, 0, apiKeyId ?? null);
      const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://arbisim-guard.vercel.app';
      return {
        result: {
          session_id: sessionId,
          simulation_type: 'x402_payment',
          status: 'PENDING',
          message: 'x402 payment simulation queued. Poll get_simulation_status with this session_id. Check flags.low_agent_reputation and flags.x402_payment_risk in the result.',
          trust_url: `${SITE_URL}/trust/${sessionId}`,
          erc8004_check,
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Failed to queue x402 simulation: ${err.message}` } };
    }
  }

  return { error: { code: -32601, message: `Unknown tool: ${name}` } };
}
