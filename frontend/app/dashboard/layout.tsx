import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-base flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 border-r border-border bg-surface shrink-0 flex flex-col">
        <div className="h-14 flex items-center px-6 border-b border-border">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-coral to-amber flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <span className="font-semibold text-text-primary">ArbiSim</span>
          </Link>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link href="/dashboard" className="block px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors">
            Overview
          </Link>
          <Link href="/dashboard/simulate" className="block px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors">
            Live Simulation
          </Link>
          <Link href="/dashboard/api-keys" className="block px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors">
            API Keys
          </Link>
          <Link href="/dashboard/billing" className="block px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors">
            Billing
          </Link>
          <Link href="/dashboard/settings" className="block px-3 py-2 rounded-md text-sm font-medium text-text-secondary hover:text-text-primary hover:bg-elevated transition-colors">
            Settings
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
