import type { Metadata } from 'next';
import { Inter, JetBrains_Mono, Fraunces } from 'next/font/google';
import './globals.css';
import Providers from './Providers';

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
  metadataBase: new URL('https://arbisim-guard.vercel.app'),
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
  icons: {
    icon: [
      { url: '/favicon-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/favicon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body style={{ fontFamily: 'var(--font-sans, system-ui, sans-serif)' }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
