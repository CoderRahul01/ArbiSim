'use client';

import { useEffect, useState } from 'react';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.workers.dev';

type AlertLevel = 'danger' | 'warn';

interface Alert {
  level: AlertLevel;
  message: string;
}

export default function DashboardToasts() {
  const [alert, setAlert] = useState<Alert | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const key = (localStorage.getItem('arbisim_api_key') ?? '').trim().replace(/[^\x20-\x7E]/g, '');
    if (!key) return;

    fetch(`${CF_WORKER_URL}/api/v1/stats`, { headers: { 'X-API-Key': key } })
      .then(r => r.ok ? r.json() : null)
      .then((data: {
        today?: number;
        quota_used?: number;
        quota_limit?: number;
        approval_rate?: number | null;
      } | null) => {
        if (!data) return;

        const used  = data.quota_used  ?? 0;
        const limit = data.quota_limit ?? 500;
        const pct   = limit > 0 ? Math.round((used / limit) * 100) : 0;

        if (pct >= 100) {
          setAlert({ level: 'danger', message: 'Monthly quota exhausted - all simulation requests are being rejected. Upgrade to continue.' });
        } else if (pct >= 80) {
          setAlert({ level: 'warn', message: `${pct}% of monthly quota used - ${(limit - used).toLocaleString()} simulations remaining this month.` });
        } else if ((data.today ?? 0) >= 5 && data.approval_rate != null && data.approval_rate < 50) {
          setAlert({ level: 'warn', message: `High rejection rate this month (${data.approval_rate}% approval) - review your transaction parameters.` });
        }
      })
      .catch(() => {});
  }, []);

  if (!alert || dismissed) return null;

  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-4 px-5 py-2.5 text-xs font-medium border-b ${
        alert.level === 'danger'
          ? 'bg-danger/10 border-danger/30 text-danger'
          : 'bg-amber/10 border-amber/30 text-amber'
      }`}
    >
      <span>{alert.message}</span>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss alert"
        className="shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
          <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}
