import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../..', '.env') });

export const config = {
  gateway: {
    port: Number(process.env.GATEWAY_PORT ?? process.env.PORT ?? 3001),
    host: process.env.GATEWAY_HOST ?? '0.0.0.0',
    internalSecret: process.env.GATEWAY_INTERNAL_SECRET ?? '',
  },
  anvil: {
    port: Number(process.env.ANVIL_PORT ?? 8545),
    forkUrl: process.env.ANVIL_FORK_URL ?? process.env.ARBITRUM_ONE_RPC ?? 'https://arb1.arbitrum.io/rpc',
  },
  worker: {
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 3),
    pollIntervalMs: Number(process.env.WORKER_POLL_INTERVAL_MS ?? 500),
    gatewayUrl: process.env.WORKER_GATEWAY_URL ?? 'http://127.0.0.1:3001',
  },
  db: {
    mongoUri: process.env.MONGODB_URI ?? '',
    mongoDbName: process.env.MONGODB_DB_NAME ?? 'arbisim',
    neonUrl: process.env.NEONDB_URL ?? process.env.DATABASE_URL ?? '',
    redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  contracts: {
    entrypointV06: process.env.ENTRYPOINT_V06 ?? '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789',
    entrypointV07: process.env.ENTRYPOINT_V07 ?? '0x0000000071727De22E5E9d8BAf0edAc6f37da032',
    simulationRegistry: process.env.SIMULATION_REGISTRY_ADDRESS ?? '',
  },
  api: {
    adminKey: process.env.ADMIN_API_KEY ?? '',
    hashSalt: process.env.API_KEY_HASH_SALT ?? '',
  },
} as const;
