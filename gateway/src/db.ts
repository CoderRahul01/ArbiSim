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
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

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
  created_at: Date;
  updated_at: Date;
}

export async function createSimulation(
  sessionId: string,
  network: string,
  agentAddress: string
): Promise<SimulationRow> {
  const queryText = `
    INSERT INTO simulations (session_id, network, agent_address, status)
    VALUES ($1, $2, $3, 'PENDING')
    RETURNING *
  `;
  const res = await pgPool.query(queryText, [sessionId, network, agentAddress]);
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
