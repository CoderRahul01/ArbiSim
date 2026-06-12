'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { StatusTracker, DayStatus, StatusType } from './StatusTracker';

// Helper to generate realistic-looking mock data
function generateMockHistory(seed: number, targetUptime: number, numOutages: number): DayStatus[] {
  const history: DayStatus[] = [];
  const today = new Date();
  
  // Decide randomly which days will have outages
  const outageDays = new Set<number>();
  for (let i = 0; i < numOutages; i++) {
    const dayIndex = Math.floor(Math.sin(seed + i * 123.45) * 45 + 45); // deterministic pseudo-random 0-89
    outageDays.add(dayIndex);
  }

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    
    let status: StatusType = 'operational';
    let uptimePercent = 100.0;

    if (outageDays.has(89 - i)) {
      // It's an outage day. Determine severity
      const severity = Math.sin(seed + i * 999);
      if (severity > 0) {
        status = 'degraded';
        uptimePercent = 95 + (Math.sin(seed + i) * 4); // 91-99%
      } else {
        status = 'downtime';
        uptimePercent = 80 + (Math.sin(seed + i) * 15); // 65-95%
      }
    } else {
      // Add a tiny bit of jitter to uptime to make the overall average realistic
      // Only deduct tiny amounts like 0.01% occasionally
      if (Math.sin(seed + i * 42) > 0.8) {
        uptimePercent = 99.98 + (Math.sin(seed + i) * 0.01);
      }
    }

    history.push({
      date: dateStr,
      status,
      uptimePercent,
    });
  }
  return history;
}

export default function StatusPage() {
  const services = useMemo(() => [
    {
      name: 'ArbiSim Engine (Anvil)',
      history: generateMockHistory(1, 99.9, 1), // Very stable
    },
    {
      name: 'Gateway API (Cloudflare)',
      history: generateMockHistory(2, 99.99, 0), // Flawless
    },
    {
      name: 'Dashboard UI (Vercel)',
      history: generateMockHistory(3, 99.95, 2), // 2 small blips
    },
    {
      name: 'Telemetry Storage (MongoDB)',
      history: generateMockHistory(4, 99.8, 3), // Minor issues
    }
  ], []);

  // Determine overall status. If any service is downtime today, overall is downtime.
  const todayStatuses = services.map(s => s.history[s.history.length - 1].status);
  const overallStatus: StatusType = todayStatuses.includes('downtime') 
    ? 'downtime' 
    : todayStatuses.includes('degraded') 
      ? 'degraded' 
      : 'operational';

  const overallBanner = {
    'operational': { text: 'All Systems Operational', color: 'bg-teal text-white shadow-teal/20 border-teal/40' },
    'degraded': { text: 'Degraded Performance', color: 'bg-amber text-bg-base shadow-amber/20 border-amber/40' },
    'downtime': { text: 'Partial System Outage', color: 'bg-danger text-white shadow-danger/20 border-danger/40' },
    'unknown': { text: 'Status Unknown', color: 'bg-border text-text-primary' },
  }[overallStatus];

  return (
    <div className="min-h-screen bg-base flex flex-col font-sans">
      {/* Navbar */}
      <header className="h-16 flex items-center px-6 md:px-12 border-b border-border bg-surface/50 backdrop-blur-sm sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-3 group">
          <Image src="/logo.png" alt="ArbiSim Guard" width={28} height={28} className="rounded-md shadow-sm shadow-coral/30" />
          <span className="font-semibold text-text-primary text-lg font-serif">ArbiSim Guard <span className="font-sans text-text-secondary font-medium ml-1">Status</span></span>
        </Link>
        <div className="ml-auto">
          <Link href="/dashboard" className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-3 py-2 rounded-lg hover:bg-elevated">
            Dashboard
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-12 md:py-20 animate-fade-in">
        
        {/* Banner */}
        <div className={`px-6 py-4 rounded-xl border font-medium text-lg tracking-tight shadow-lg mb-12 ${overallBanner.color}`}>
          {overallBanner.text}
        </div>

        {/* Trackers */}
        <div className="bg-surface border border-border rounded-xl p-6 md:p-10 shadow-xl shadow-black/20">
          <div className="flex justify-end mb-6 text-xs text-text-tertiary">
            Uptime over the past 90 days. <a href="#" className="text-text-secondary ml-1 hover:underline">View historical uptime.</a>
          </div>
          
          <div className="flex flex-col gap-2">
            {services.map(service => (
              <StatusTracker 
                key={service.name} 
                serviceName={service.name} 
                history={service.history} 
              />
            ))}
          </div>
        </div>

        <div className="mt-12 text-center text-sm text-text-tertiary">
          <p>Powered by ArbiSim Guard Telemetry.</p>
          <p className="mt-1"><Link href="/dashboard" className="hover:text-text-secondary underline underline-offset-2">Return to Dashboard</Link></p>
        </div>

      </main>
    </div>
  );
}
