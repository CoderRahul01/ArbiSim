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
    await client.query(`ALTER TABLE simulations ADD COLUMN IF NOT EXISTS owner_address VARCHAR(42)`);
    await client.query(`ALTER TABLE simulations ADD COLUMN IF NOT EXISTS rewards_processed BOOLEAN DEFAULT FALSE`);

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

    // ── Credit System Tables ──────────────────────────────────────────────

    // Users table - tracks wallet-based users and their credit balance
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        wallet_address  VARCHAR(42) PRIMARY KEY,
        credit_balance  INTEGER NOT NULL DEFAULT 0,
        total_purchased INTEGER NOT NULL DEFAULT 0,
        total_consumed  INTEGER NOT NULL DEFAULT 0,
        referral_code   VARCHAR(20) UNIQUE,
        referred_by     VARCHAR(42),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    // Credit transactions - immutable ledger of all credit changes
    await client.query(`
      CREATE TABLE IF NOT EXISTS credit_transactions (
        id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        wallet_address VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
        amount      INTEGER NOT NULL,
        type        VARCHAR(30) NOT NULL,
        description TEXT,
        reference_id TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await client.query(
      'CREATE INDEX IF NOT EXISTS ct_wallet_idx ON credit_transactions (wallet_address, created_at DESC)'
    );

    // Referral codes table
    await client.query(`
      CREATE TABLE IF NOT EXISTS referral_codes (
        code            VARCHAR(20) PRIMARY KEY,
        owner_wallet    VARCHAR(42) NOT NULL REFERENCES users(wallet_address),
        bonus_credits   INTEGER NOT NULL DEFAULT 50,
        times_used      INTEGER NOT NULL DEFAULT 0,
        max_uses        INTEGER NOT NULL DEFAULT 100,
        active          BOOLEAN NOT NULL DEFAULT TRUE
      )
    `);

    // Create sim_views table
    await client.query(`
      CREATE TABLE IF NOT EXISTS sim_views (
        sim_id VARCHAR(36) NOT NULL,
        ip_hash VARCHAR(64) NOT NULL,
        viewed_at TIMESTAMPTZ DEFAULT NOW(),
        PRIMARY KEY (sim_id, ip_hash)
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
  api_key_id?: string | null;
  owner_address?: string | null;
  rewards_processed?: boolean;
  created_at: Date;
  updated_at: Date;
}

export async function createSimulation(
  sessionId: string,
  network: string,
  agentAddress: string,
  apiKeyId: string | null = null,
  ownerAddress: string | null = null
): Promise<SimulationRow> {
  const queryText = `
    INSERT INTO simulations (session_id, network, agent_address, status, api_key_id, owner_address)
    VALUES ($1, $2, $3, 'PENDING', $4, $5)
    RETURNING *
  `;
  const res = await pgPool.query(queryText, [
    sessionId,
    network,
    agentAddress,
    apiKeyId,
    ownerAddress ? ownerAddress.toLowerCase() : null
  ]);
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

// ── Credit System Helpers ─────────────────────────────────────────────────

export interface UserRow {
  wallet_address: string;
  credit_balance: number;
  total_purchased: number;
  total_consumed: number;
  referral_code: string | null;
  referred_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function getOrCreateUser(walletAddress: string): Promise<UserRow> {
  const addr = walletAddress.toLowerCase();
  const res = await pgPool.query(
    `INSERT INTO users (wallet_address, credit_balance)
     VALUES ($1, 0)
     ON CONFLICT (wallet_address) DO UPDATE SET updated_at = NOW()
     RETURNING *`,
    [addr]
  );
  return res.rows[0];
}

export async function getUserCredits(walletAddress: string): Promise<number> {
  const addr = walletAddress.toLowerCase();
  const res = await pgPool.query(
    'SELECT credit_balance FROM users WHERE wallet_address = $1',
    [addr]
  );
  return res.rows[0]?.credit_balance ?? 0;
}

export async function addCredits(
  walletAddress: string,
  amount: number,
  type: string,
  description: string,
  referenceId?: string
): Promise<number> {
  const addr = walletAddress.toLowerCase();
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `UPDATE users
       SET credit_balance = credit_balance + $1,
           total_purchased = total_purchased + $1,
           updated_at = NOW()
       WHERE wallet_address = $2`,
      [amount, addr]
    );
    await client.query(
      `INSERT INTO credit_transactions (wallet_address, amount, type, description, reference_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [addr, amount, type, description, referenceId ?? null]
    );
    const res = await client.query(
      'SELECT credit_balance FROM users WHERE wallet_address = $1',
      [addr]
    );
    await client.query('COMMIT');
    return res.rows[0].credit_balance;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function deductCredit(
  walletAddress: string,
  amount: number = 1,
  description: string = 'simulation'
): Promise<{ success: boolean; remaining: number }> {
  const addr = walletAddress.toLowerCase();
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    const res = await client.query(
      `UPDATE users
       SET credit_balance = credit_balance - $1,
           total_consumed = total_consumed + $1,
           updated_at = NOW()
       WHERE wallet_address = $2 AND credit_balance >= $1
       RETURNING credit_balance`,
      [amount, addr]
    );
    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      const bal = await pgPool.query('SELECT credit_balance FROM users WHERE wallet_address = $1', [addr]);
      return { success: false, remaining: bal.rows[0]?.credit_balance ?? 0 };
    }
    await client.query(
      `INSERT INTO credit_transactions (wallet_address, amount, type, description)
       VALUES ($1, $2, 'deduction', $3)`,
      [addr, -amount, description]
    );
    await client.query('COMMIT');
    return { success: true, remaining: res.rows[0].credit_balance };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getCreditHistory(
  walletAddress: string,
  limit: number = 50
): Promise<any[]> {
  const addr = walletAddress.toLowerCase();
  const res = await pgPool.query(
    `SELECT id, amount, type, description, reference_id, created_at
     FROM credit_transactions
     WHERE wallet_address = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [addr, limit]
  );
  return res.rows;
}

export async function createReferralCode(
  walletAddress: string,
  code: string,
  bonusCredits: number = 50
): Promise<void> {
  const addr = walletAddress.toLowerCase();
  await pgPool.query(
    `INSERT INTO referral_codes (code, owner_wallet, bonus_credits)
     VALUES ($1, $2, $3)`,
    [code.toUpperCase(), addr, bonusCredits]
  );
  await pgPool.query(
    `UPDATE users SET referral_code = $1 WHERE wallet_address = $2`,
    [code.toUpperCase(), addr]
  );
}

export async function redeemReferralCode(
  walletAddress: string,
  code: string
): Promise<{ success: boolean; message: string }> {
  const addr = walletAddress.toLowerCase();
  const codeUpper = code.toUpperCase();
  const client = await pgPool.connect();
  try {
    await client.query('BEGIN');
    // Check if user already used a referral
    const userRes = await client.query(
      'SELECT referred_by FROM users WHERE wallet_address = $1',
      [addr]
    );
    if (userRes.rows[0]?.referred_by) {
      await client.query('ROLLBACK');
      return { success: false, message: 'You have already used a referral code.' };
    }
    // Check if code exists and is active
    const codeRes = await client.query(
      'SELECT * FROM referral_codes WHERE code = $1 AND active = TRUE AND times_used < max_uses',
      [codeUpper]
    );
    if (codeRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, message: 'Invalid or expired referral code.' };
    }
    const refCode = codeRes.rows[0];
    if (refCode.owner_wallet === addr) {
      await client.query('ROLLBACK');
      return { success: false, message: 'You cannot use your own referral code.' };
    }
    const bonus = refCode.bonus_credits;
    // Credit the new user
    await client.query(
      `UPDATE users SET credit_balance = credit_balance + $1, referred_by = $2, updated_at = NOW() WHERE wallet_address = $3`,
      [bonus, refCode.owner_wallet, addr]
    );
    await client.query(
      `INSERT INTO credit_transactions (wallet_address, amount, type, description, reference_id) VALUES ($1, $2, 'referral_bonus', 'Referral code bonus', $3)`,
      [addr, bonus, codeUpper]
    );
    // Credit the referrer
    await client.query(
      `UPDATE users SET credit_balance = credit_balance + $1, updated_at = NOW() WHERE wallet_address = $2`,
      [bonus, refCode.owner_wallet]
    );
    await client.query(
      `INSERT INTO credit_transactions (wallet_address, amount, type, description, reference_id) VALUES ($1, $2, 'referral_reward', 'Referral reward for code usage', $3)`,
      [refCode.owner_wallet, bonus, codeUpper]
    );
    // Increment usage count
    await client.query(
      `UPDATE referral_codes SET times_used = times_used + 1 WHERE code = $1`,
      [codeUpper]
    );
    await client.query('COMMIT');
    return { success: true, message: `${bonus} credits added to your account!` };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function checkAndAwardSimulationRewards(
  ownerAddress: string,
  network: string,
  sessionId: string
): Promise<void> {
  const addr = ownerAddress.toLowerCase();
  
  // 1. First sim on new chain (+3)
  try {
    const chainCountRes = await pgPool.query(
      `SELECT COUNT(*)::integer as count 
       FROM simulations 
       WHERE owner_address = $1 AND network = $2 AND status IN ('APPROVED', 'REJECTED') AND session_id != $3`,
      [addr, network, sessionId]
    );
    const firstSim = (chainCountRes.rows[0]?.count ?? 0) === 0;
    if (firstSim) {
      await addCredits(
        addr,
        3,
        'first_chain_bonus',
        `First simulation bonus on ${network}`,
        sessionId
      );
      console.log(`[Rewards] Awarded +3 credits to ${addr} for first sim on ${network}.`);
    }
  } catch (err) {
    console.error(`[Rewards] First chain reward failed for ${addr}:`, err);
  }

  // 2. Milestone: 10 sims in month (+5) / 50 sims in month (+15)
  try {
    const monthlyCountRes = await pgPool.query(
      `SELECT COUNT(*)::integer as count 
       FROM simulations 
       WHERE owner_address = $1 AND status IN ('APPROVED', 'REJECTED') AND created_at >= date_trunc('month', now())`,
      [addr]
    );
    const monthlyCount = monthlyCountRes.rows[0]?.count ?? 0;
    
    if (monthlyCount === 10) {
      await addCredits(
        addr,
        5,
        'monthly_10_bonus',
        'Milestone bonus: 10 simulations in a month',
        sessionId
      );
      console.log(`[Rewards] Awarded +5 credits to ${addr} for 10 sims milestone.`);
    } else if (monthlyCount === 50) {
      await addCredits(
        addr,
        15,
        'monthly_50_bonus',
        'Milestone bonus: 50 simulations in a month',
        sessionId
      );
      console.log(`[Rewards] Awarded +15 credits to ${addr} for 50 sims milestone.`);
    }
  } catch (err) {
    console.error(`[Rewards] Milestone rewards failed for ${addr}:`, err);
  }
}

export async function recordSimView(
  sessionId: string,
  ipHash: string
): Promise<{ success: boolean; uniqueViews: number }> {
  try {
    await pgPool.query(
      `INSERT INTO sim_views (sim_id, ip_hash) VALUES ($1, $2)`,
      [sessionId, ipHash]
    );

    const countRes = await pgPool.query(
      `SELECT COUNT(*)::integer as count FROM sim_views WHERE sim_id = $1`,
      [sessionId]
    );
    const uniqueViews = countRes.rows[0]?.count ?? 0;

    if (uniqueViews === 5) {
      const sim = await getSimulation(sessionId);
      if (sim && sim.owner_address) {
        await addCredits(
          sim.owner_address,
          2,
          'share_reward',
          `Share reward: 5 unique views on simulation ${sessionId.slice(0, 8)}`,
          sessionId
        );
        console.log(`[Rewards] Awarded +2 credits to ${sim.owner_address} for 5 unique views on sim ${sessionId}`);
      }
    }

    return { success: true, uniqueViews };
  } catch (err: any) {
    if (err.code === '23505') {
      // Unique constraint violation (duplicate view)
      const countRes = await pgPool.query(
        `SELECT COUNT(*)::integer as count FROM sim_views WHERE sim_id = $1`,
        [sessionId]
      );
      return { success: false, uniqueViews: countRes.rows[0]?.count ?? 0 };
    }
    throw err;
  }
}

