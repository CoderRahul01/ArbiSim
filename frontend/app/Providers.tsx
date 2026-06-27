'use client';

import React, { ReactNode, useEffect } from 'react';
import { wagmiConfig, wagmiAdapter, networks, projectId, metadata } from '@/lib/wagmi/config';
import { createAppKit } from '@reown/appkit/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { State, WagmiProvider } from 'wagmi';
import { createSIWEConfig, formatMessage } from '@reown/appkit-siwe';
import { initPostHog, posthog } from '@/lib/posthog';

const queryClient = new QueryClient();
const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

const siweConfig = createSIWEConfig({
  getMessageParams: async () => {
    const res = await fetch(`${CF_WORKER_URL}/api/v1/auth/nonce`);
    const { nonce } = await res.json();
    return {
      domain: typeof window !== 'undefined' ? window.location.host : 'arbisim-guard.vercel.app',
      uri: typeof window !== 'undefined' ? window.location.origin : 'https://arbisim-guard.vercel.app',
      chains: networks.map(c => Number(c.id)),
      statement: 'Sign in to ArbiSim Guard.',
      nonce,
    };
  },
  createMessage: ({ address, ...args }) => formatMessage(args, address),
  getNonce: async () => {
    const res = await fetch(`${CF_WORKER_URL}/api/v1/auth/nonce`);
    const { nonce } = await res.json();
    return nonce;
  },
  getSession: async () => {
    if (typeof window === 'undefined') return null;
    const token = localStorage.getItem('arbisim_jwt');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.exp * 1000 < Date.now()) {
        localStorage.removeItem('arbisim_jwt');
        return null;
      }
      return { address: payload.address, chainId: 42161 };
    } catch {
      return null;
    }
  },
  verifyMessage: async ({ message, signature }) => {
    // Extract address from SIWE message (line 2 usually, or use regex)
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
    const address = addressMatch ? addressMatch[0] : '';
    
    const res = await fetch(`${CF_WORKER_URL}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, address }),
    });
    
    if (res.ok) {
      const { token } = await res.json();
      localStorage.setItem('arbisim_jwt', token);
      posthog.identify(address, { wallet_address: address });
      posthog.capture('user_signed_in', { address });
      return true;
    }
    return false;
  },
  signOut: async () => {
    localStorage.removeItem('arbisim_jwt');
    return true;
  }
});

createAppKit({
  adapters: [wagmiAdapter],
  projectId,
  networks,
  defaultNetwork: networks[0],
  metadata,
  siweConfig,
  features: {
    analytics: true
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#FF6B6B',
  }
});

export default function Providers({ children, initialState }: { children: ReactNode; initialState?: State }) {
  useEffect(() => { initPostHog(); }, []);

  return (
    <WagmiProvider config={wagmiConfig as any} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}
