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

