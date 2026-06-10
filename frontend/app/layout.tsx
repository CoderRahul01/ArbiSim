import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'ArbiSim Guard — Pre-Flight Simulation for AI Agents',
  description:
    'Test DeFi transactions in an isolated Arbitrum fork before executing with real capital. Catch reverts, slippage, MEV attacks, and stale UserOps before they cost you.',
  openGraph: {
    title: 'ArbiSim Guard',
    description: 'Pre-flight simulation API for AI agents on Arbitrum.',
    url: 'https://arbisim-guard.vercel.app',
    siteName: 'ArbiSim Guard',
    images: [{ url: '/og.png', width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/favicon.ico' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body style={{ fontFamily: 'var(--font-inter, system-ui, sans-serif)' }}>{children}</body>
    </html>
  );
}
