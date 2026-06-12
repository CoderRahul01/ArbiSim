import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { arbitrum, arbitrumSepolia } from '@reown/appkit/networks';

export const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'b56e464e737aa27f691651ea1023ba11';

if (!projectId) {
  console.warn('Reown Project ID is not defined. Please set NEXT_PUBLIC_REOWN_PROJECT_ID');
}

export const metadata = {
  name: 'ArbiSim Guard',
  description: 'Pre-flight simulation API for AI agents on Arbitrum.',
  url: 'https://arbisim-guard.vercel.app', 
  icons: ['https://arbisim-guard.vercel.app/favicon.png']
}

import { type AppKitNetwork } from '@reown/appkit/networks';

export const networks = [arbitrum, arbitrumSepolia] as [AppKitNetwork, ...AppKitNetwork[]];

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks,
  ssr: true
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
