/**
 * mcp-tools.ts
 * Shared MCP tool definitions and execution logic used by both:
 *  - StdioServerTransport (index.ts, --mcp flag)
 *  - POST /api/v1/mcp HTTP bridge (routes.ts)
 */

import { v4 as uuidv4 } from 'uuid';
import {
  getSimulation, getMongoDb, createBacktest, getBacktest,
  createAgentSession, getAgentSession, appendSessionSimulation, completeAgentSession,
} from './db.js';
import { submitSimulationJob } from './queue.js';

// ── Tool definitions ────────────────────────────────────────────────────────

export const MCP_TOOLS = [
  {
    name: 'preflight_simulate',
    description: 'Submit a transaction batch for pre-flight simulation on isolated ephemeral Anvil forks of Arbitrum. Returns a session_id to poll for results.',
    inputSchema: {
      type: 'object',
      properties: {
        network: {
          type: 'string',
          enum: ['arbitrum-one', 'arbitrum-sepolia', 'robinhood-chain-testnet', 'ethereum', 'bnb', 'avalanche'],
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
    name: 'agent_session_start',
    description: 'Start an agent training session. Returns a session_id that pins a fork block for reproducible sequential simulations over the next 24 hours.',
    inputSchema: {
      type: 'object',
      properties: {
        agent_address: { type: 'string', description: 'EVM wallet address of the agent (0x-prefixed)' },
        chain: {
          type: 'string',
          enum: ['arbitrum-one', 'arbitrum-sepolia', 'robinhood-chain-testnet', 'ethereum', 'bnb', 'avalanche'],
          description: 'Chain to fork for this session (default: arbitrum-one)',
        },
        fork_block: { type: 'number', description: 'Optional block number to pin the fork at. Defaults to latest.' },
      },
      required: ['agent_address'],
    },
  },
  {
    name: 'agent_session_simulate',
    description: 'Run a simulation within an active agent training session. Appends to the sequential experiment log and updates cumulative P&L.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'UUID returned by agent_session_start' },
        transaction: {
          type: 'object',
          description: 'Single transaction to simulate',
          properties: {
            to:       { type: 'string' },
            data:     { type: 'string' },
            value:    { type: 'string' },
            gasLimit: { type: 'string' },
          },
          required: ['to', 'data', 'value'],
        },
        max_slippage_tolerance: { type: 'number', description: 'Max slippage tolerance %' },
      },
      required: ['session_id', 'transaction'],
    },
  },
  {
    name: 'agent_session_end',
    description: 'End an agent training session and receive full analytics: success rate, Sharpe ratio, max drawdown, most common risk flag, gas saved.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string', description: 'UUID returned by agent_session_start' },
      },
      required: ['session_id'],
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
      return {
        result: {
          session_id: sessionId,
          status: '202 Accepted',
          message: 'Simulation queued. Poll get_simulation_status with this session_id.',
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
      return {
        result: {
          session_id: pgRecord.session_id,
          network: pgRecord.network,
          agent_address: pgRecord.agent_address,
          status: pgRecord.status,
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

  if (name === 'agent_session_start') {
    const { agent_address, chain = 'arbitrum-one', fork_block } = args as any;
    if (!agent_address) return { error: { code: -32602, message: 'agent_address is required' } };
    if (!apiKeyId) return { error: { code: -32602, message: 'API key required for agent sessions' } };
    try {
      const row = await createAgentSession(apiKeyId, agent_address, chain, fork_block);
      return {
        result: {
          session_id: row.session_id,
          chain: row.chain,
          fork_block: row.fork_block,
          expires_at: row.expires_at,
          message: 'Session started. Use agent_session_simulate to run experiments, agent_session_end to get analytics.',
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Failed to start session: ${err.message}` } };
    }
  }

  if (name === 'agent_session_simulate') {
    const { session_id, transaction, max_slippage_tolerance = 1.0 } = args as any;
    if (!session_id || !transaction) return { error: { code: -32602, message: 'session_id and transaction are required' } };
    try {
      const sess = await getAgentSession(session_id);
      if (!sess) return { error: { code: -32602, message: `Session ${session_id} not found` } };
      if (sess.status !== 'active') return { error: { code: -32602, message: `Session is ${sess.status}, not active` } };
      if (new Date() > new Date(sess.expires_at)) return { error: { code: -32602, message: 'Session has expired' } };

      const jobId = uuidv4();
      await submitSimulationJob(jobId, sess.chain, sess.agent_address, [transaction], max_slippage_tolerance, sess.api_key_id);

      // Poll for completion (up to 30s)
      let simResult: any = null;
      for (let i = 0; i < 60; i++) {
        await new Promise(r => (globalThis as any).setTimeout(r, 500));
        const pgRecord = await getSimulation(jobId);
        if (pgRecord && ['APPROVED', 'REJECTED', 'FAILED'].includes(pgRecord.status)) {
          let telemetry: any = null;
          try {
            telemetry = await getMongoDb().collection('telemetry').findOne({ session_id: jobId });
          } catch {}
          simResult = { pgRecord, telemetry: telemetry || pgRecord.telemetry };
          break;
        }
      }

      if (!simResult) return { error: { code: -32603, message: 'Simulation timed out after 30s' } };

      const { pgRecord, telemetry } = simResult;
      const pnlUsd = telemetry ? parseFloat(telemetry.net_pnl_usd ?? '0') : 0;
      const gasL2 = telemetry?.gas_breakdown?.l2_gas_used ?? 0;
      const gasL1 = telemetry?.gas_breakdown?.l1_gas_buffer ?? null;
      const flags: Record<string, boolean> = telemetry ? {
        execution_reverted: !!telemetry.revert_reason,
        high_slippage: parseFloat(telemetry.slippage_detected ?? '0') > 2,
        sandwich_detected: (telemetry.timeboost_mev_telemetry?.mev_sandwich_risk_score ?? 0) > 0.5,
      } : {};

      const simRow = await appendSessionSimulation(
        session_id, jobId, pgRecord.status, gasL2, gasL1 ? Math.round(gasL1) : null, pnlUsd, flags
      );

      return {
        result: {
          sequence_num: simRow.sequence_num,
          job_id: jobId,
          outcome: pgRecord.status,
          pnl_usd: pnlUsd.toFixed(2),
          gas_l2: gasL2,
          risk_flags: flags,
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Session simulate failed: ${err.message}` } };
    }
  }

  if (name === 'agent_session_end') {
    const { session_id } = args as any;
    if (!session_id) return { error: { code: -32602, message: 'session_id is required' } };
    try {
      const { session, sims } = await completeAgentSession(session_id);
      const total = sims.length;
      const approved = sims.filter(s => s.outcome === 'APPROVED').length;
      const successRate = total > 0 ? approved / total : 0;

      const pnls = sims.map(s => parseFloat(s.pnl_usd ?? '0'));
      let sharpeRatio: number | null = null;
      if (total >= 5) {
        const mean = pnls.reduce((a, b) => a + b, 0) / total;
        const variance = pnls.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / total;
        const stddev = Math.sqrt(variance);
        sharpeRatio = stddev > 0 ? (mean / stddev) * Math.sqrt(total) : 0;
      }

      let maxDrawdown = 0;
      let peak = 0;
      let running = 0;
      for (const pnl of pnls) {
        running += pnl;
        if (running > peak) peak = running;
        const dd = peak - running;
        if (dd > maxDrawdown) maxDrawdown = dd;
      }

      const flagCounts: Record<string, number> = {};
      for (const sim of sims) {
        if (sim.risk_flags) {
          for (const [flag, active] of Object.entries(sim.risk_flags as Record<string, boolean>)) {
            if (active) flagCounts[flag] = (flagCounts[flag] ?? 0) + 1;
          }
        }
      }
      const mostCommonFlag = Object.entries(flagCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return {
        result: {
          session_id,
          chain: session.chain,
          sim_count: total,
          success_rate: parseFloat((successRate * 100).toFixed(1)),
          cumulative_pnl_usd: parseFloat(session.cumulative_pnl_usd),
          total_gas_saved_usd: parseFloat(session.total_gas_saved_usd),
          sharpe_ratio: sharpeRatio !== null ? parseFloat(sharpeRatio.toFixed(4)) : null,
          max_drawdown_usd: parseFloat(maxDrawdown.toFixed(2)),
          most_common_flag: mostCommonFlag,
          completed_at: session.completed_at,
        },
      };
    } catch (err: any) {
      return { error: { code: -32603, message: `Failed to end session: ${err.message}` } };
    }
  }

  return { error: { code: -32601, message: `Unknown tool: ${name}` } };
}
