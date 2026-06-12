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
import { initDb } from './db.js';
import { MCP_TOOLS, callMcpTool } from './mcp-tools.js';

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

// Register MCP Tools List — sourced from shared mcp-tools.ts
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: MCP_TOOLS }));

// Register MCP Tool Execution — delegates to shared callMcpTool()
mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  if (!args) throw new McpError(ErrorCode.InvalidParams, 'Arguments are required');

  const { result, error } = await callMcpTool(name, args as Record<string, unknown>);

  if (error) {
    if (error.code === -32601) throw new McpError(ErrorCode.MethodNotFound, error.message);
    if (error.code === -32602) throw new McpError(ErrorCode.InvalidParams, error.message);
    return { isError: true, content: [{ type: 'text', text: error.message }] };
  }

  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
});

// Bootstrap function
async function main() {
  try {
    // 1. Initialize databases
    await initDb();

    // 2. Start Express app if not running in pure CLI/MCP mode
    if (!isMcpMode) {
      app.listen(port, '0.0.0.0', () => {
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
