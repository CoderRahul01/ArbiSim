'use client';

import React, { useState } from 'react';

export type StatusType = 'operational' | 'degraded' | 'downtime' | 'unknown';

export interface DayStatus {
  date: string; // YYYY-MM-DD
  status: StatusType;
  uptimePercent: number;
}

interface StatusTrackerProps {
  serviceName: string;
  history: DayStatus[]; // Exactly 90 days
}

export function StatusTracker({ serviceName, history }: StatusTrackerProps) {
  // Ensure we have 90 days
  const displayHistory = history.length > 90 ? history.slice(-90) : history;
  
  // Current status (based on the last day, i.e., today)
  const currentDay = displayHistory[displayHistory.length - 1];
  const isOperational = currentDay?.status === 'operational';

  // Overall uptime calculation
  const totalUptime = displayHistory.reduce((acc, curr) => acc + curr.uptimePercent, 0);
  const averageUptime = displayHistory.length ? (totalUptime / displayHistory.length).toFixed(2) : '100.00';

  const [hoveredDay, setHoveredDay] = useState<DayStatus | null>(null);

  const getBarColor = (status: StatusType) => {
    switch (status) {
      case 'operational': return 'bg-teal';
      case 'degraded': return 'bg-amber';
      case 'downtime': return 'bg-danger';
      default: return 'bg-border';
    }
  };

  const getStatusText = (status: StatusType) => {
    switch (status) {
      case 'operational': return 'Operational';
      case 'degraded': return 'Degraded Performance';
      case 'downtime': return 'Outage';
      default: return 'Unknown';
    }
  };

  const getStatusColorClass = (status: StatusType) => {
    switch (status) {
      case 'operational': return 'text-teal';
      case 'degraded': return 'text-amber';
      case 'downtime': return 'text-danger';
      default: return 'text-text-tertiary';
    }
  };

  return (
    <div className="py-6 border-b border-border last:border-0">
      <div className="flex justify-between items-baseline mb-4">
        <h3 className="text-base font-semibold text-text-primary">{serviceName}</h3>
        <span className={`text-sm font-medium ${getStatusColorClass(currentDay?.status ?? 'unknown')}`}>
          {getStatusText(currentDay?.status ?? 'unknown')}
        </span>
      </div>

      {/* Bars container */}
      <div className="relative group w-full flex items-end h-[36px] gap-[2px] md:gap-1">
        {displayHistory.map((day, idx) => (
          <div
            key={day.date}
            className={`flex-1 h-full rounded-sm opacity-90 hover:opacity-100 transition-opacity cursor-pointer ${getBarColor(day.status)}`}
            onMouseEnter={() => setHoveredDay(day)}
            onMouseLeave={() => setHoveredDay(null)}
          />
        ))}

        {/* Hover Tooltip */}
        {hoveredDay && (
          <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-elevated border border-border text-xs px-3 py-1.5 rounded shadow-xl pointer-events-none z-10 font-mono whitespace-nowrap animate-slide-up">
            <span className="text-text-secondary">{hoveredDay.date}</span>
            <span className="mx-2 text-border">|</span>
            <span className={getStatusColorClass(hoveredDay.status)}>
              {hoveredDay.uptimePercent === 100 ? '100 % uptime' : `${hoveredDay.uptimePercent.toFixed(2)} % uptime`}
            </span>
          </div>
        )}
      </div>

      <div className="flex justify-between text-xs text-text-tertiary mt-2 font-mono">
        <span>90 days ago</span>
        <span className="text-text-secondary border-t border-border flex-1 mx-4 mt-2" />
        <span className="text-text-secondary">{averageUptime} % uptime</span>
        <span className="text-text-secondary border-t border-border flex-1 mx-4 mt-2" />
        <span>Today</span>
      </div>
    </div>
  );
}
