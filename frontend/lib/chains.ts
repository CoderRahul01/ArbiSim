export interface ChainInfo {
  id: string;
  name: string;
  displayName: string;
  nativeToken: string;
  blockExplorer: string;
  badge?: string | null;
  isNitro: boolean;
  hasStylus: boolean;
  hasErc8004: boolean;
  comingSoon?: boolean;
}

export const SUPPORTED_NETWORKS: Record<string, ChainInfo> = {
  'arbitrum-one': {
    id: 'arbitrum-one',
    name: 'arbitrum-one',
    displayName: 'Arbitrum One',
    nativeToken: 'ETH',
    blockExplorer: 'https://arbiscan.io',
    badge: null,
    isNitro: true,
    hasStylus: true,
    hasErc8004: false,
  },
  'arbitrum-sepolia': {
    id: 'arbitrum-sepolia',
    name: 'arbitrum-sepolia',
    displayName: 'Arbitrum Sepolia',
    nativeToken: 'ETH',
    blockExplorer: 'https://sepolia.arbiscan.io',
    badge: null,
    isNitro: true,
    hasStylus: true,
    hasErc8004: false,
  },
  'avalanche-mainnet': {
    id: 'avalanche-mainnet',
    name: 'avalanche-mainnet',
    displayName: 'Avalanche C-Chain',
    nativeToken: 'AVAX',
    blockExplorer: 'https://subnets.avax.network/c-chain',
    badge: 'NEW',
    isNitro: false,
    hasStylus: false,
    hasErc8004: true,
  },
  'avalanche-fuji': {
    id: 'avalanche-fuji',
    name: 'avalanche-fuji',
    displayName: 'Avalanche Fuji Testnet',
    nativeToken: 'AVAX',
    blockExplorer: 'https://subnets-test.avax.network/c-chain',
    badge: 'NEW',
    isNitro: false,
    hasStylus: false,
    hasErc8004: true,
  },
  'robinhood-chain-testnet': {
    id: 'robinhood-chain-testnet',
    name: 'robinhood-chain-testnet',
    displayName: 'Robinhood Chain Testnet',
    nativeToken: 'ETH',
    blockExplorer: '',
    badge: null,
    isNitro: true,
    hasStylus: false,
    hasErc8004: false,
  },
  'base-mainnet': {
    id: 'base-mainnet',
    name: 'base-mainnet',
    displayName: 'Base Mainnet',
    nativeToken: 'ETH',
    blockExplorer: 'https://basescan.org',
    badge: null,
    isNitro: false,
    hasStylus: false,
    hasErc8004: false,
    comingSoon: true,
  },
  'bnb-mainnet': {
    id: 'bnb-mainnet',
    name: 'bnb-mainnet',
    displayName: 'BNB Chain',
    nativeToken: 'BNB',
    blockExplorer: 'https://bscscan.com',
    badge: null,
    isNitro: false,
    hasStylus: false,
    hasErc8004: false,
    comingSoon: true,
  },
  'polygon-mainnet': {
    id: 'polygon-mainnet',
    name: 'polygon-mainnet',
    displayName: 'Polygon PoS',
    nativeToken: 'POL',
    blockExplorer: 'https://polygonscan.com',
    badge: null,
    isNitro: false,
    hasStylus: false,
    hasErc8004: false,
    comingSoon: true,
  },
};
