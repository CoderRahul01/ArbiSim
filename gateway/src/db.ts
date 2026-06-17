import { Pool } from 'pg';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

const postgresUrl =
  process.env.NEONDB_URL ||
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/arbisim_guard';
const mongoUrl = process.env.MONGODB_URI || 'mongodb://localhost:27017/arbisim_guard';

// Initialize PostgreSQL Pool
export const pgPool = new Pool({
  connectionString: postgresUrl,
});

// Initialize MongoDB Client
export const mongoClient = new MongoClient(mongoUrl, { serverSelectionTimeoutMS: 2000 });
let mongoDbConnected = false;

export async function connectMongo() {
  if (!mongoDbConnected) {
    try {
      await mongoClient.connect();
      mongoDbConnected = true;
      console.log('Successfully connected to MongoDB');
    } catch (err) {
      console.error('Failed to connect to MongoDB:', err);
    }
  }
}

export function getMongoDb() {
  const dbName = mongoUrl.split('/').pop()?.split('?')[0] || 'arbisim_guard';
  return mongoClient.db(dbName);
}

// Database Initialization
export async function initDb(): Promise<void> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');

    // Create simulations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulations (
        session_id UUID PRIMARY KEY,
        network VARCHAR(50) NOT NULL,
        agent_address VARCHAR(42) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        telemetry JSONB,
        api_key_id TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(`ALTER TABLE simulations ADD COLUMN IF NOT EXISTS api_key_id TEXT`);

    // Create database-backed queue table
    await client.query(`
      CREATE TABLE IF NOT EXISTS simulation_queue (
        id SERIAL PRIMARY KEY,
        session_id UUID NOT NULL REFERENCES simulations(session_id) ON DELETE CASCADE,
        payload JSONB NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Backtesting suite table
    await client.query(`
      CREATE TABLE IF NOT EXISTS backtests (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id      TEXT,
        network         VARCHAR(50) NOT NULL,
        agent_address   VARCHAR(42) NOT NULL,
        strategy        JSONB NOT NULL,
        block_start     BIGINT NOT NULL,
        block_end       BIGINT NOT NULL,
        block_stride    INTEGER NOT NULL DEFAULT 100,
        status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        results         JSONB,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS bt_status_idx ON backtests (status, created_at ASC)'
    );

    // Create webhooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id  TEXT NOT NULL,
        url         TEXT NOT NULL,
        secret      TEXT NOT NULL,
        events      TEXT[] NOT NULL DEFAULT ARRAY['simulation.completed'],
        active      BOOLEAN NOT NULL DEFAULT TRUE,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS webhooks_key_idx ON webhooks (api_key_id) WHERE active = TRUE'
    );
 
    // Create verified_payments table to prevent replay/double-spend attacks
    await client.query(`
      CREATE TABLE IF NOT EXISTS verified_payments (
        tx_hash       VARCHAR(66) PRIMARY KEY,
        user_address  VARCHAR(42) NOT NULL,
        tier          VARCHAR(20) NOT NULL,
        amount        VARCHAR(30) NOT NULL,
        verified_at   TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Agent training session tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS agent_sessions (
        session_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        api_key_id    TEXT NOT NULL,
        agent_address TEXT NOT NULL,
        chain         TEXT NOT NULL DEFAULT 'arbitrum-one',
        fork_block    BIGINT,
        status        TEXT NOT NULL DEFAULT 'active',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours',
        completed_at  TIMESTAMPTZ,
        sim_count     INT NOT NULL DEFAULT 0,
        cumulative_pnl_usd    NUMERIC(20,6) NOT NULL DEFAULT 0,
        total_gas_saved_usd   NUMERIC(20,6) NOT NULL DEFAULT 0
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS agent_sessions_key_idx ON agent_sessions (api_key_id, status)`
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS session_simulations (
        id            SERIAL PRIMARY KEY,
        session_id    UUID NOT NULL REFERENCES agent_sessions(session_id) ON DELETE CASCADE,
        job_id        TEXT NOT NULL,
        sequence_num  INT NOT NULL,
        outcome       TEXT,
        gas_l2        BIGINT,
        gas_l1        BIGINT,
        pnl_usd       NUMERIC(20,6),
        risk_flags    JSONB,
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      `CREATE INDEX IF NOT EXISTS session_sims_session_idx ON session_simulations (session_id, sequence_num)`
    );

    await client.query('COMMIT');
    console.log('PostgreSQL schemas initialized successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Failed to initialize PostgreSQL database schemas:', error);
    throw error;
  } finally {
    client.release();
  }

  // Ensure MongoDB is connected
  try {
    await connectMongo();
  } catch (mongoErr) {
    console.warn('MongoDB connection failed. Telemetry will fallback to PostgreSQL storage.');
  }
}

// Helper methods for database transactions
export interface SimulationRow {
  session_id: string;
  network: string;
  agent_address: string;
  status: string;
  telemetry?: any;
  api_key_id?: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function createSimulation(
  sessionId: string,
  network: string,
  agentAddress: string,
  apiKeyId: string | null = null
): Promise<SimulationRow> {
  const queryText = `
    INSERT INTO simulations (session_id, network, agent_address, status, api_key_id)
    VALUES ($1, $2, $3, 'PENDING', $4)
    RETURNING *
  `;
  const res = await pgPool.query(queryText, [sessionId, network, agentAddress, apiKeyId]);
  return res.rows[0];
}

export async function getSimulation(sessionId: string): Promise<SimulationRow | null> {
  const queryText = 'SELECT * FROM simulations WHERE session_id = $1';
  const res = await pgPool.query(queryText, [sessionId]);
  if (res.rows.length === 0) {
    return null;
  }
  return res.rows[0];
}

export async function updateSimulationStatus(sessionId: string, status: string): Promise<void> {
  const queryText = `
    UPDATE simulations
    SET status = $1, updated_at = NOW()
    WHERE session_id = $2
  `;
  await pgPool.query(queryText, [status, sessionId]);
}

export async function updateSimulationStatusAndTelemetry(
  sessionId: string,
  status: string,
  telemetry: any
): Promise<void> {
  const queryText = `
    UPDATE simulations
    SET status = $1, telemetry = $2, updated_at = NOW()
    WHERE session_id = $3
  `;
  await pgPool.query(queryText, [status, JSON.stringify(telemetry), sessionId]);
}

export async function enqueueSimulation(sessionId: string, payload: any): Promise<void> {
  const queryText = `
    INSERT INTO simulation_queue (session_id, payload, status)
    VALUES ($1, $2, 'PENDING')
  `;
  await pgPool.query(queryText, [sessionId, JSON.stringify(payload)]);
}

// ── API Key helpers ────────────────────────────────────────────────────────

export interface ApiKeyRow {
  id: string;
  prefix: string;
  tier: string;
  monthly_quota: number;
  created_at: Date;
}

export async function createApiKey(
  prefix: string,
  hash: string,
  tier: string,
  ownerEmail?: string
): Promise<ApiKeyRow> {
  const res = await pgPool.query(
    `INSERT INTO api_keys (prefix, hash, tier, owner_email)
     VALUES ($1, $2, $3, $4)
     RETURNING id, prefix, tier, monthly_quota, created_at`,
    [prefix, hash, tier, ownerEmail ?? null]
  );
  return res.rows[0];
}

export async function getApiKeyByPrefix(prefix: string): Promise<{ id: string; hash: string; tier: string } | null> {
  const res = await pgPool.query(
    `SELECT id, prefix, hash, tier, monthly_quota
     FROM api_keys
     WHERE prefix = $1 AND revoked_at IS NULL
     LIMIT 1`,
    [prefix]
  );
  return res.rows[0] ?? null;
}

export async function incrementApiKeyUsage(id: string): Promise<void> {
  await pgPool.query(
    `UPDATE api_keys SET usage_count = COALESCE(usage_count, 0) + 1 WHERE id = $1`,
    [id]
  );
}

// ── Backtest helpers ───────────────────────────────────────────────────────

export interface BacktestRow {
  id: string;
  api_key_id: string | null;
  network: string;
  agent_address: string;
  strategy: any;
  block_start: number;
  block_end: number;
  block_stride: number;
  status: string;
  results: any;
  created_at: Date;
  updated_at: Date;
}

export async function createBacktest(
  apiKeyId: string | null,
  network: string,
  agentAddress: string,
  strategy: any,
  blockStart: number,
  blockEnd: number,
  blockStride: number
): Promise<BacktestRow> {
  const res = await pgPool.query(
    `INSERT INTO backtests (api_key_id, network, agent_address, strategy, block_start, block_end, block_stride, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDING')
     RETURNING *`,
    [apiKeyId, network, agentAddress, JSON.stringify(strategy), blockStart, blockEnd, blockStride]
  );
  return res.rows[0];
}

export async function getBacktest(id: string): Promise<BacktestRow | null> {
  const res = await pgPool.query('SELECT * FROM backtests WHERE id = $1', [id]);
  return res.rows[0] ?? null;
}

export async function listBacktests(apiKeyId: string | null, limit: number = 20): Promise<BacktestRow[]> {
  const res = await pgPool.query(
    `SELECT * FROM backtests WHERE api_key_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [apiKeyId, limit]
  );
  return res.rows;
}

// ── Logs & Simulation Scoping helpers ──────────────────────────────────────

export async function listSimulations(
  apiKeyId: string,
  filters: { status?: string; network?: string; from?: Date; to?: Date; limit: number; offset: number }
): Promise<{ rows: SimulationRow[]; total: number }> {
  const conditions = ['api_key_id = $1'];
  const params: any[] = [apiKeyId];

  if (filters.status && filters.status !== 'All') {
    params.push(filters.status);
    conditions.push(`status = $${params.length}`);
  }
  if (filters.network && filters.network !== 'All') {
    params.push(filters.network);
    conditions.push(`network = $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`created_at >= $${params.length}`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`created_at <= $${params.length}`);
  }

  const whereClause = conditions.join(' AND ');

  const countRes = await pgPool.query(
    `SELECT COUNT(*)::integer FROM simulations WHERE ${whereClause}`,
    params
  );
  const total = countRes.rows[0].count;

  params.push(filters.limit);
  const limitIndex = params.length;
  params.push(filters.offset);
  const offsetIndex = params.length;

  const selectRes = await pgPool.query(
    `SELECT * FROM simulations WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
    params
  );

  return { rows: selectRes.rows, total };
}

// ── Webhook helpers ────────────────────────────────────────────────────────

export interface WebhookRow {
  id: string;
  api_key_id: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  created_at: Date;
}

export async function createWebhook(
  apiKeyId: string,
  url: string,
  secret: string,
  events: string[] = ['simulation.completed']
): Promise<WebhookRow> {
  const res = await pgPool.query(
    `INSERT INTO webhooks (api_key_id, url, secret, events, active)
     VALUES ($1, $2, $3, $4, TRUE)
     RETURNING *`,
    [apiKeyId, url, secret, events]
  );
  return res.rows[0];
}

export async function listWebhooks(apiKeyId: string): Promise<WebhookRow[]> {
  const res = await pgPool.query(
    `SELECT id, api_key_id, url, events, active, created_at FROM webhooks WHERE api_key_id = $1 AND active = TRUE ORDER BY created_at DESC`,
    [apiKeyId]
  );
  return res.rows;
}

export async function deleteWebhook(id: string, apiKeyId: string): Promise<boolean> {
  const res = await pgPool.query(
    `UPDATE webhooks SET active = FALSE WHERE id = $1 AND api_key_id = $2`,
    [id, apiKeyId]
  );
  return (res.rowCount ?? 0) > 0;
}

export async function getWebhooksForKey(apiKeyId: string): Promise<WebhookRow[]> {
  const res = await pgPool.query(
    `SELECT * FROM webhooks WHERE api_key_id = $1 AND active = TRUE`,
    [apiKeyId]
  );
  return res.rows;
}

// ── Web3 Verified Payments helpers (to prevent replay attacks) ──────────────

export async function isPaymentVerified(txHash: string): Promise<boolean> {
  const res = await pgPool.query(
    'SELECT 1 FROM verified_payments WHERE tx_hash = $1 LIMIT 1',
    [txHash.toLowerCase()]
  );
  return res.rows.length > 0;
}

export async function recordPayment(
  txHash: string,
  userAddress: string,
  tier: string,
  amount: string
): Promise<void> {
  await pgPool.query(
    `INSERT INTO verified_payments (tx_hash, user_address, tier, amount)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (tx_hash) DO NOTHING`,
    [txHash.toLowerCase(), userAddress.toLowerCase(), tier.toLowerCase(), amount]
  );
}

// ── Agent Training Session helpers ─────────────────────────────────────────

export interface AgentSessionRow {
  session_id: string;
  api_key_id: string;
  agent_address: string;
  chain: string;
  fork_block: number | null;
  status: string;
  created_at: Date;
  expires_at: Date;
  completed_at: Date | null;
  sim_count: number;
  cumulative_pnl_usd: string;
  total_gas_saved_usd: string;
}

export interface SessionSimulationRow {
  id: number;
  session_id: string;
  job_id: string;
  sequence_num: number;
  outcome: string | null;
  gas_l2: number | null;
  gas_l1: number | null;
  pnl_usd: string | null;
  risk_flags: any;
  created_at: Date;
}

export async function createAgentSession(
  apiKeyId: string,
  agentAddress: string,
  chain: string,
  forkBlock?: number
): Promise<AgentSessionRow> {
  const res = await pgPool.query(
    `INSERT INTO agent_sessions (api_key_id, agent_address, chain, fork_block)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [apiKeyId, agentAddress, chain, forkBlock ?? null]
  );
  return res.rows[0];
}

export async function getAgentSession(sessionId: string): Promise<AgentSessionRow | null> {
  const res = await pgPool.query('SELECT * FROM agent_sessions WHERE session_id = $1', [sessionId]);
  return res.rows[0] ?? null;
}

export async function appendSessionSimulation(
  sessionId: string,
  jobId: string,
  outcome: string,
  gasL2: number,
  gasL1: number | null,
  pnlUsd: number,
  riskFlags: Record<string, boolean>
): Promise<SessionSimulationRow> {
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const seqRes = await client.query(
      `SELECT COALESCE(MAX(sequence_num), 0) + 1 AS next_seq FROM session_simulations WHERE session_id = $1`,
      [sessionId]
    );
    const nextSeq: number = seqRes.rows[0].next_seq;

    const simRes = await client.query(
      `INSERT INTO session_simulations (session_id, job_id, sequence_num, outcome, gas_l2, gas_l1, pnl_usd, risk_flags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [sessionId, jobId, nextSeq, outcome, gasL2, gasL1 ?? null, pnlUsd, JSON.stringify(riskFlags)]
    );

    const gasSaved = outcome === 'REJECTED' ? Math.abs(pnlUsd) : 0;
    await client.query(
      `UPDATE agent_sessions
       SET sim_count = sim_count + 1,
           cumulative_pnl_usd = cumulative_pnl_usd + $1,
           total_gas_saved_usd = total_gas_saved_usd + $2,
           updated_at = NOW()
       WHERE session_id = $3`,
      [pnlUsd, gasSaved, sessionId]
    );
    await client.query('COMMIT');
    return simRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function completeAgentSession(sessionId: string): Promise<{
  session: AgentSessionRow;
  sims: SessionSimulationRow[];
}> {
  await pgPool.query(
    `UPDATE agent_sessions SET status = 'completed', completed_at = NOW() WHERE session_id = $1`,
    [sessionId]
  );
  const sessionRes = await pgPool.query('SELECT * FROM agent_sessions WHERE session_id = $1', [sessionId]);
  const simsRes = await pgPool.query(
    'SELECT * FROM session_simulations WHERE session_id = $1 ORDER BY sequence_num ASC',
    [sessionId]
  );
  return { session: sessionRes.rows[0], sims: simsRes.rows };
}

