/**
 * chain-config.ts
 * TypeScript mirror of workers/src/chain_config.py.
 * Single source of truth for network validation and chain metadata in the gateway.
 * Adding a new chain = one new entry in CHAIN_REGISTRY. Nothing else.
 */

export interface ChainFeatures {
  timeboost: boolean;
  stylus: boolean;
  l1DataFee: boolean;
  warpMessaging: boolean;
  erc8004: boolean;
}

export interface ChainConfig {
  chainId: number;
  name: string;
  displayName: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeToken: string;
  testnet: boolean;
  registryAddress?: string;
  features: ChainFeatures;
}

export const CHAIN_REGISTRY: Record<string, ChainConfig> = {

  // ── ARBITRUM ──────────────────────────────────────────────────────────────
  'arbitrum-one': {
    chainId: 42161,
    name: 'arbitrum-one',
    displayName: 'Arbitrum One',
    rpcUrl: process.env.ARBITRUM_ONE_RPC ?? 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    nativeToken: 'ETH',
    testnet: false,
    registryAddress: process.env.SIMULATION_REGISTRY_ADDRESS ?? '0x9784f7cA750f1301a2090eaDF8f27F78B1A326b2',
    features: { timeboost: true, stylus: true, l1DataFee: true, warpMessaging: false, erc8004: false },
  },

  'arbitrum-sepolia': {
    chainId: 421614,
    name: 'arbitrum-sepolia',
    displayName: 'Arbitrum Sepolia',
    rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC ?? 'https://sepolia-rollup.arbitrum.io/rpc',
    blockExplorer: 'https://sepolia.arbiscan.io',
    nativeToken: 'ETH',
    testnet: true,
    registryAddress: process.env.ARBITRUM_SEPOLIA_REGISTRY ?? '0x5Dfd08c3d44BEBfa61a24Af8c2EfbDB5A01dFA32',
    features: { timeboost: false, stylus: true, l1DataFee: true, warpMessaging: false, erc8004: false },
  },

  // ── AVALANCHE ─────────────────────────────────────────────────────────────
  'avalanche-mainnet': {
    chainId: 43114,
    name: 'avalanche-mainnet',
    displayName: 'Avalanche C-Chain',
    rpcUrl: process.env.AVALANCHE_MAINNET_RPC ?? 'https://api.avax.network/ext/bc/C/rpc',
    blockExplorer: 'https://subnets.avax.network/c-chain',
    nativeToken: 'AVAX',
    testnet: false,
    registryAddress: process.env.AVALANCHE_MAINNET_REGISTRY ?? '0xb947B914fCb605D114E9f3C784a3fdE20B3f5CCc',
    features: { timeboost: false, stylus: false, l1DataFee: false, warpMessaging: true, erc8004: true },
  },

  'avalanche-fuji': {
    chainId: 43113,
    name: 'avalanche-fuji',
    displayName: 'Avalanche Fuji Testnet',
    rpcUrl: process.env.AVALANCHE_FUJI_RPC ?? 'https://api.avax-test.network/ext/bc/C/rpc',
    blockExplorer: 'https://subnets-test.avax.network/c-chain',
    nativeToken: 'AVAX',
    testnet: true,
    registryAddress: process.env.AVALANCHE_FUJI_REGISTRY,
    features: { timeboost: false, stylus: false, l1DataFee: false, warpMessaging: true, erc8004: true },
  },

  // ── ROBINHOOD ─────────────────────────────────────────────────────────────
  'robinhood-chain-testnet': {
    chainId: 46630,
    name: 'robinhood-chain-testnet',
    displayName: 'Robinhood Chain Testnet',
    rpcUrl: process.env.ROBINHOOD_CHAIN_TESTNET_RPC ?? '',
    blockExplorer: '',
    nativeToken: 'ETH',
    testnet: true,
    features: { timeboost: false, stylus: false, l1DataFee: true, warpMessaging: false, erc8004: false },
  },
};

export const VALID_NETWORKS: string[] = Object.keys(CHAIN_REGISTRY);

export function getChain(network: string): ChainConfig {
  const cfg = CHAIN_REGISTRY[network];
  if (!cfg) {
    throw new Error(`Unsupported network: '${network}'. Supported: ${VALID_NETWORKS.join(', ')}`);
  }
  return cfg;
}

export function listChains(testnet?: boolean): string[] {
  if (testnet === undefined) return VALID_NETWORKS;
  return VALID_NETWORKS.filter(k => CHAIN_REGISTRY[k].testnet === testnet);
}
