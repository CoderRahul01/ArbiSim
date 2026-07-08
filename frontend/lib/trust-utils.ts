import { createPublicClient, http, keccak256, toBytes } from 'viem';
import { arbitrum, arbitrumSepolia, avalanche, avalancheFuji } from 'viem/chains';

export interface DecodedFlags {
  revert: boolean;
  high_slippage: boolean;
  mev_risk: boolean;
  gas_estimate_high: boolean;
  low_reputation: boolean;
  unknown_agent: boolean;
  price_impact_high: boolean;
  insufficient_liquidity: boolean;
  bridge_risk: boolean;
  oracle_manipulation: boolean;
  value_transfer: boolean;
  contract_creation: boolean;
}

export const FLAG_LABELS: Record<keyof DecodedFlags, string> = {
  revert: 'Execution Revert',
  high_slippage: 'High Slippage',
  mev_risk: 'MEV / Frontrun Risk',
  gas_estimate_high: 'High Gas Cost',
  low_reputation: 'Low Payee Reputation',
  unknown_agent: 'Unregistered Payee',
  price_impact_high: 'High Price Impact',
  insufficient_liquidity: 'Insufficient Liquidity',
  bridge_risk: 'Bridge Risk',
  oracle_manipulation: 'Oracle Price Deviation',
  value_transfer: 'High Value Transfer',
  contract_creation: 'Contract Deployment',
};

export const FLAG_BITS: Record<keyof DecodedFlags, number> = {
  revert: 1 << 0,
  high_slippage: 1 << 1,
  mev_risk: 1 << 2,
  gas_estimate_high: 1 << 3,
  low_reputation: 1 << 4,
  unknown_agent: 1 << 5,
  price_impact_high: 1 << 6,
  insufficient_liquidity: 1 << 7,
  bridge_risk: 1 << 8,
  oracle_manipulation: 1 << 9,
  value_transfer: 1 << 10,
  contract_creation: 1 << 11,
};

export function decodeFlags(bitmap: number): (keyof DecodedFlags)[] {
  const active: (keyof DecodedFlags)[] = [];
  (Object.keys(FLAG_BITS) as (keyof DecodedFlags)[]).forEach((key) => {
    if ((bitmap & FLAG_BITS[key]) !== 0) {
      active.push(key);
    }
  });
  return active;
}

export const REGISTRY_ADDRESSES: Record<string, `0x${string}` | ''> = {
  'arbitrum-one': (process.env.NEXT_PUBLIC_SIMULATION_REGISTRY_ADDRESS || '0x9784f7cA750f1301a2090eaDF8f27F78B1A326b2') as `0x${string}`,
  'arbitrum-sepolia': (process.env.NEXT_PUBLIC_SIMULATION_REGISTRY_SEPOLIA || '0x5Dfd08c3d44BEBfa61a24Af8c2EfbDB5A01dFA32') as `0x${string}`,
  'avalanche-fuji': (process.env.NEXT_PUBLIC_AVALANCHE_FUJI_REGISTRY || '0xe940d0f71718F3deaff790d7DC53C775B07E3c54') as `0x${string}`,
  'avalanche-mainnet': (process.env.NEXT_PUBLIC_AVALANCHE_MAINNET_REGISTRY || '') as `0x${string}` | '',
};

export const RPC_URLS: Record<string, string> = {
  'arbitrum-one': process.env.NEXT_PUBLIC_ARB_ONE_RPC || 'https://arb1.arbitrum.io/rpc',
  'arbitrum-sepolia': process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc',
  'avalanche-mainnet': process.env.NEXT_PUBLIC_AVALANCHE_MAINNET_RPC || 'https://api.avax.network/ext/bc/C/rpc',
  'avalanche-fuji': process.env.NEXT_PUBLIC_AVALANCHE_FUJI_RPC || 'https://api.avax-test.network/ext/bc/C/rpc',
};

export const START_BLOCKS: Record<string, bigint> = {
  'arbitrum-one': BigInt(223000000),
  'arbitrum-sepolia': BigInt(56000000),
  'avalanche-mainnet': BigInt(53000000),
  'avalanche-fuji': BigInt(32000000),
};

export const VIEM_CHAINS: Record<string, any> = {
  'arbitrum-one': arbitrum,
  'arbitrum-sepolia': arbitrumSepolia,
  'avalanche-mainnet': avalanche,
  'avalanche-fuji': avalancheFuji,
};

export function getPublicClient(network: string) {
  const chain = VIEM_CHAINS[network];
  const rpcUrl = RPC_URLS[network];
  if (!chain || !rpcUrl) return null;
  return createPublicClient({
    chain,
    transport: http(rpcUrl),
  });
}

/**
 * Computes deterministic Keccak-256 hash of evidence items.
 * Keys in each object are sorted alphabetically, then serialised compactly.
 */
export function getCanonicalEvidenceHash(evidenceReport: any[]): string {
  const canonicalList = evidenceReport.map((item: any) => {
    const sortedItem: any = {};
    Object.keys(item).sort().forEach((key) => {
      sortedItem[key] = item[key];
    });
    return sortedItem;
  });
  const canonicalStr = JSON.stringify(canonicalList);
  return keccak256(toBytes(canonicalStr));
}
