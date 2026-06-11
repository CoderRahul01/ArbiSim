import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from '@modelcontextprotocol/sdk/types.js';

import { config } from './config.js';
import { router, publicRouter } from './routes.js';
import adminRouter from './routes/admin.js';
import backtestRouter from './routes/backtest.js';
import webhookRouter from './routes/webhooks.js';
import { requireAuth } from './middleware/auth.js';
import { initDb, getSimulation, getMongoDb } from './db.js';
import { submitSimulationJob } from './queue.js';
import { v4 as uuidv4 } from 'uuid';

// Redirect console.log to stderr when running MCP in stdio mode so it does not corrupt JSON-RPC communications
const isMcpMode = process.argv.includes('--mcp');
if (isMcpMode) {
  const originalLog = console.log;
  console.log = (...args) => {
    console.error(...args);
  };
}

const app = express();
const port = config.gateway.port;

app.use(express.json());

// Public simulation permalink routes (no auth)
app.use('/api/v1/sim', publicRouter);

// Auth-protected simulation routes
app.use('/api/v1', requireAuth, router);

// Backtest routes (authenticated)
app.use('/api/v1/backtest', requireAuth, backtestRouter);

// Webhook routes (authenticated)
app.use('/api/v1/webhooks', requireAuth, webhookRouter);

// Admin routes (use own key check inside router)
app.use('/admin', adminRouter);

// Setup Swagger / OpenAPI specs
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ArbiSim Guard API',
      version: '1.0.0',
      description: 'Pre-Flight AI Agent Execution & Simulation Layer API documentation.',
    },
    servers: [
      {
        url: `http://localhost:${port}`,
        description: 'Development Server',
      },
    ],
  },
  apis: ['./src/routes.ts', './dist/routes.js'],
};

const swaggerSpecs = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs));

// Define the MCP Server
const mcpServer = new Server(
  {
    name: 'arbisim-guard',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register MCP Tools List
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'preflight_simulate',
        description: 'Submit transaction batch for pre-flight simulation on isolated local forks of Arbitrum.',
        inputSchema: {
          type: 'object',
          properties: {
            network: {
              type: 'string',
              enum: ['arbitrum-one', 'arbitrum-sepolia', 'robinhood-chain-testnet'],
              description: 'Target blockchain network'
            },
            agent_address: {
              type: 'string',
              description: 'Hexadecimal EVM wallet address of the agent (starts with 0x)'
            },
            transactions: {
              type: 'array',
              description: 'Ordered array of transaction transactions to execute',
              items: {
                type: 'object',
                properties: {
                  to: { type: 'string', description: 'Hex target contract or receiver address' },
                  data: { type: 'string', description: 'Hex call data' },
                  value: { type: 'string', description: 'Value in Wei as string' },
                  gasLimit: { type: 'string', description: 'Optional gas limit override' }
                },
                required: ['to', 'data', 'value']
              }
            },
            max_slippage_tolerance: {
              type: 'number',
              description: 'Max slippage percentage scale (e.g. 0.5 for 0.5%)'
            }
          },
          required: ['network', 'agent_address', 'transactions', 'max_slippage_tolerance']
        }
      },
      {
        name: 'get_simulation_status',
        description: 'Retrieve current status and calculated metrics/logs for a simulation session.',
        inputSchema: {
          type: 'object',
          properties: {
            session_id: {
              type: 'string',
              description: 'The UUID session ID returned by preflight_simulate'
            }
          },
          required: ['session_id']
        }
      }
    ]
  };
});

// Register MCP Tool Execution Call Handler
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === 'preflight_simulate') {
    if (!args) {
      throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');
    }

    const { network, agent_address, transactions, max_slippage_tolerance } = args as any;

    if (!network || !agent_address || !transactions || max_slippage_tolerance === undefined) {
      throw new McpError(ErrorCode.InvalidParams, 'Missing required parameters');
    }

    try {
      const sessionId = uuidv4();
      await submitSimulationJob(
        sessionId,
        network,
        agent_address,
        transactions,
        max_slippage_tolerance
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              session_id: sessionId,
              status: '202 Accepted',
              message: 'Simulation request successfully received and queued.',
            }, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Failed to queue simulation: ${err.message}`,
          },
        ],
      };
    }
  } else if (name === 'get_simulation_status') {
    if (!args || !args.session_id) {
      throw new McpError(ErrorCode.InvalidParams, 'session_id is required');
    }

    const sessionId = args.session_id as string;
    try {
      const pgRecord = await getSimulation(sessionId);
      if (!pgRecord) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Simulation session ${sessionId} not found.`,
            },
          ],
        };
      }

      let mongoRecord = null;
      try {
        const mongoDb = getMongoDb();
        mongoRecord = await mongoDb.collection('telemetry').findOne({ session_id: sessionId });
      } catch (err) {
        // Suppress and fallback to PostgreSQL
      }

      const telemetry = mongoRecord || pgRecord.telemetry;

      const payload = {
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
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(payload, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error retrieving simulation status: ${err.message}`,
          },
        ],
      };
    }
  } else {
    throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

// Bootstrap function
async function main() {
  try {
    // 1. Initialize databases
    await initDb();

    // 2. Start Express app if not running in pure CLI/MCP mode
    if (!isMcpMode) {
      app.listen(port, () => {
        console.log(`ArbiSim Guard Express Gateway running on port ${port}`);
        console.log(`Swagger documentation available at http://localhost:${port}/api-docs`);
      });
    }

    // 3. Connect MCP transport
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('Model Context Protocol Stdio server connected and running.');
  } catch (error) {
    console.error('Fatal initialization error:', error);
    process.exit(1);
  }
}

main();
