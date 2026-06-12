'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

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
    href: '/dashboard/mcp-playground',
    label: 'MCP Playground',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M1 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M9 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
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

function useQuotaAlert() {
  const [alert, setAlert] = useState<{ level: 'warn' | 'critical' | null; pct: number }>({ level: null, pct: 0 });

  useEffect(() => {
    const dismissed = sessionStorage.getItem('arbisim_quota_alert_dismissed');
    if (dismissed) return;

    const key = localStorage.getItem('arbisim_api_key') ?? '';
    if (!key) return;

    fetch(`${CF_WORKER_URL}/api/v1/stats`, { headers: { 'X-API-Key': key } })
      .then(r => r.ok ? r.json() : null)
      .then((data: { quota_used?: number; quota_limit?: number } | null) => {
        if (!data?.quota_limit) return;
        const pct = Math.round((data.quota_used ?? 0) / data.quota_limit * 100);
        if (pct >= 100) setAlert({ level: 'critical', pct });
        else if (pct >= 80) setAlert({ level: 'warn', pct });
      })
      .catch(() => {});
  }, []);

  return alert;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isConnected } = useAccount();
  const quotaAlert = useQuotaAlert();
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [jwt, setJwt] = useState<string | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem('arbisim_jwt');
      if (!token) {
        setJwt(null);
        setCheckingAuth(false);
        return;
      }
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        if (payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('arbisim_jwt');
          setJwt(null);
        } else {
          setJwt(token);
        }
      } catch {
        localStorage.removeItem('arbisim_jwt');
        setJwt(null);
      }
      setCheckingAuth(false);
    };

    checkAuth();
    const interval = setInterval(checkAuth, 1000);
    return () => clearInterval(interval);
  }, []);

  function dismissAlert() {
    sessionStorage.setItem('arbisim_quota_alert_dismissed', '1');
    setAlertDismissed(true);
  }

  function isActive(href: string) {
    if (href === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(href);
  }

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-base flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-coral border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isConnected || !jwt) {
    return (
      <div className="min-h-screen bg-base flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Glow backgrounds */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-coral/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="glass max-w-md w-full rounded-2xl p-8 border border-border shadow-2xl flex flex-col items-center text-center relative z-10 animate-slide-up">
          <div className="w-16 h-16 rounded-2xl bg-coral/10 border border-coral/20 flex items-center justify-center mb-6 shadow-lg shadow-coral/10">
            <Image src="/logo.png" alt="ArbiSim Guard" width={40} height={40} className="rounded-lg shrink-0 shadow-sm" />
          </div>
          <h2 className="text-2xl font-bold text-text-primary mb-3">Welcome to ArbiSim Guard</h2>
          <p className="text-sm text-text-secondary mb-8 max-w-sm leading-relaxed">
            Please connect your wallet and sign in using SIWE to access the dashboard.
          </p>
          <div className="w-full flex justify-center py-2">
            <appkit-button />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base flex flex-col">
      {/* Quota alert banner */}
      {!alertDismissed && quotaAlert.level && (
        <div className={`flex items-center justify-between px-5 py-2.5 text-xs font-medium ${
          quotaAlert.level === 'critical'
            ? 'bg-danger/10 border-b border-danger/30 text-danger'
            : 'bg-amber/10 border-b border-amber/30 text-amber'
        }`}>
          <span>
            {quotaAlert.level === 'critical'
              ? 'Monthly quota exhausted. All simulation requests are being rejected until reset.'
              : `You've used ${quotaAlert.pct}% of your monthly quota. Upgrade to Pro to get 10,000 simulations.`}
          </span>
          <button onClick={dismissAlert} className="ml-4 shrink-0 opacity-70 hover:opacity-100 transition-opacity">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1">
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
            <div className="mb-2.5">
              <appkit-button />
            </div>
            <div className="w-full bg-border rounded-full h-1.5 mt-2.5">
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
    </div>
  );
}
