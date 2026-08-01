import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Fraunces } from 'next/font/google';
import { headers } from 'next/headers';
import { cookieToInitialState } from '@wagmi/core';
import { Analytics } from '@vercel/analytics/react';
import './globals.css';
import Providers from './Providers';
import { wagmiConfig } from '@/lib/wagmi/config';

// Sans: Geist is the "new cool for developer tools" (Vercel).
// Inter is the fallback — tall x-height, still the king of UI.
const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

// Serif: editorial display. Fraunces is the closest free analog to
// Anthropic's bespoke "Copernicus" — used for hero + h1 only.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['SOFT', 'opsz'],
  variable: '--font-serif',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://arbisimguard.com'),
  title: 'ArbiSim Guard — Multi-Chain Pre-Flight Security Layer for AI Agents',
  description:
    'Simulate AI agent transactions in block-accurate ephemeral forks across Avalanche, Injective, Solana, and Arbitrum. Catch reverts, MEV attacks, slippage blowouts, and WASM ink limits before committing real capital.',
  keywords: [
    'AI Agents',
    'Pre-flight simulation',
    'DeFi Security',
    'Avalanche',
    'Injective',
    'Solana',
    'Arbitrum',
    'Stylus WASM',
    'ERC-4337 Account Abstraction',
    'MEV Protection',
    'MCP Server',
    'Anteratic Labs',
  ],
  authors: [{ name: 'Anteratic Labs', url: 'https://arbisimguard.com' }],
  creator: 'Anteratic Labs',
  publisher: 'Anteratic Labs',
  openGraph: {
    title: 'ArbiSim Guard — Multi-Chain Pre-Flight Security Layer for AI Agents',
    description:
      'Zero-risk transaction simulation for autonomous AI agents across Avalanche, Injective, Solana, and Arbitrum. Instant APPROVED / REJECTED safety receipts.',
    url: 'https://arbisimguard.com',
    siteName: 'ArbiSim Guard (by Anteratic Labs)',
    images: [
      {
        url: '/og.png',
        width: 1200,
        height: 630,
        alt: 'ArbiSim Guard Multi-Chain Pre-Flight Simulation Engine',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ArbiSim Guard — Multi-Chain Pre-Flight Security for AI Agents',
    description:
      'Simulate AI agent payload execution across Avalanche, Injective, Solana, and Arbitrum before touching mainnet.',
    creator: '@AnteraticLabs',
    images: ['/og.png'],
  },
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
  alternates: {
    canonical: 'https://arbisimguard.com',
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const initialState = cookieToInitialState(wagmiConfig, (await headers()).get('cookie'));
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'ArbiSim Guard',
    operatingSystem: 'Multi-Chain (Avalanche, Injective, Solana, Arbitrum)',
    applicationCategory: 'SecurityApplication',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
    author: {
      '@type': 'Organization',
      name: 'Anteratic Labs',
      url: 'https://arbisimguard.com',
    },
    description:
      'Multi-chain pre-flight transaction simulation & security checkpoint for autonomous AI agents.',
  };

  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
        <Providers initialState={initialState}>{children}</Providers>
        <Analytics />
      </body>
    </html>
  );
}

