'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Overview',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="1" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="1" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="9" y="9" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/simulate',
    label: 'Live Simulation',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <polygon points="3,2 13,8 3,14" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    ),
    badge: 'live',
  },
  {
    href: '/dashboard/logs',
    label: 'Logs',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M2 3h12M2 8h12M2 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/backtest',
    label: 'Backtest',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <polyline points="1,12 4,5 7,9 10,3 13,7 15,4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/api-keys',
    label: 'API Keys',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="6" cy="6" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8.5 8.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/billing',
    label: 'Billing',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <rect x="1" y="3.5" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M1 6.5h14" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  {
    href: '/dashboard/settings',
    label: 'Settings',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  return (
    <div className="min-h-screen bg-base flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-60 border-r border-border bg-surface shrink-0 flex flex-col md:sticky md:top-0 md:h-screen">
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-border shrink-0">
          <Link href="/" className="flex items-center gap-2.5 group">
            <Image src="/logo.png" alt="ArbiSim Guard" width={24} height={24} className="rounded-md shrink-0 shadow-sm shadow-coral/30" />
            <span className="font-semibold text-text-primary text-sm">ArbiSim Guard</span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(item => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                  active
                    ? 'bg-coral/10 text-coral border border-coral/20'
                    : 'text-text-secondary hover:text-text-primary hover:bg-elevated border border-transparent'
                }`}
              >
                <span className={`shrink-0 ${active ? 'text-coral' : 'text-text-tertiary group-hover:text-text-secondary'}`}>
                  {item.icon}
                </span>
                <span className="flex-1">{item.label}</span>
                {item.badge === 'live' && (
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal animate-pulse-dot" />
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom section */}
        <div className="border-t border-border p-3 shrink-0">
          <div className="px-3 py-2.5 rounded-lg bg-elevated border border-border">
            <div className="flex items-center gap-2.5 mb-2.5">
              <div className="w-6 h-6 rounded-full bg-coral/20 flex items-center justify-center shrink-0">
                <span className="text-coral text-xs font-semibold">D</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-text-primary truncate">Demo Account</p>
                <p className="text-xs text-text-tertiary font-mono truncate">free tier</p>
              </div>
            </div>
            <div className="w-full bg-border rounded-full h-1.5">
              <div className="bg-coral h-1.5 rounded-full" style={{ width: '0%' }} />
            </div>
            <p className="text-xs text-text-tertiary mt-1.5">0 / 500 simulations</p>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
