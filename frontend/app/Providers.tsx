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
      statement: 'Sign in to ArbiSim Guard. This signature is free and does not send any transaction.',
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
      // Treat the session as expired 30 minutes early so AppKit refreshes proactively
      if (payload.exp * 1000 < Date.now() + 30 * 60 * 1000) {
        localStorage.removeItem('arbisim_jwt');
        return null;
      }
      // Return the chainId from the token if present, otherwise default to first network
      // This prevents AppKit from re-asking the user to sign just because they switched chains
      const storedChainId = localStorage.getItem('arbisim_chainId');
      return { address: payload.address, chainId: storedChainId ? Number(storedChainId) : Number(networks[0].id) };
    } catch {
      localStorage.removeItem('arbisim_jwt'); // Clean up malformed token
      return null;
    }
  },
  verifyMessage: async ({ message, signature }) => {
    // Parse address from SIWE message — it appears on a standalone line like "0x..."
    const lines = message.split('\n');
    const addressLine = lines.find((l: string) => /^0x[a-fA-F0-9]{40}$/.test(l.trim()));
    const address = addressLine?.trim() ?? message.match(/0x[a-fA-F0-9]{40}/)?.[0] ?? '';

    // Extract chainId from message too — "Chain ID: 43113"
    const chainMatch = message.match(/Chain ID: (\d+)/);
    const chainId = chainMatch ? parseInt(chainMatch[1]) : Number(networks[0].id);

    const res = await fetch(`${CF_WORKER_URL}/api/v1/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature, address }),
    });

    if (res.ok) {
      const { token } = await res.json();
      // Embed chainId into stored token payload so getSession can read it back
      try {
        const parts = token.split('.');
        const payload = JSON.parse(atob(parts[1]));
        payload.chainId = chainId;
        // We can't re-sign the JWT, so store chainId separately in localStorage
        localStorage.setItem('arbisim_jwt', token);
        localStorage.setItem('arbisim_chainId', String(chainId));
      } catch {
        localStorage.setItem('arbisim_jwt', token);
      }
      posthog.identify(address, { wallet_address: address });
      posthog.capture('user_signed_in', { address });
      return true;
    }
    return false;
  },
  signOut: async () => {
    localStorage.removeItem('arbisim_jwt');
    localStorage.removeItem('arbisim_chainId');
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
