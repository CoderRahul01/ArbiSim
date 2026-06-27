import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { arbitrum, arbitrumSepolia, type AppKitNetwork } from '@reown/appkit/networks';
import { http } from 'viem';

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'b56e464e737aa27f691651ea1023ba11';

export const metadata = {
  name: 'ArbiSim Guard',
  description: 'Pre-flight simulation API for AI agents on Arbitrum and Avalanche.',
  url: 'https://arbisim-guard.vercel.app',
  icons: ['https://arbisim-guard.vercel.app/favicon.png'],
};

export const networks = [arbitrum, arbitrumSepolia] as [AppKitNetwork, ...AppKitNetwork[]];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true,
  transports: {
    [arbitrum.id]:        http(process.env.NEXT_PUBLIC_ARB_ONE_RPC     || 'https://arb1.arbitrum.io/rpc'),
    [arbitrumSepolia.id]: http(process.env.NEXT_PUBLIC_ARB_SEPOLIA_RPC || 'https://sepolia-rollup.arbitrum.io/rpc'),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
