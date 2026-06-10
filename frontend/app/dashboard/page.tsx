export default function DashboardOverview() {
  return (
    <div className="p-8 max-w-5xl mx-auto w-full">
      <h1 className="text-2xl font-semibold text-text-primary mb-6">Overview</h1>
      
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 rounded-xl border border-border bg-surface">
          <p className="text-sm text-text-tertiary mb-1">Simulations Today</p>
          <p className="text-3xl font-semibold text-text-primary">0</p>
        </div>
        <div className="p-6 rounded-xl border border-border bg-surface">
          <p className="text-sm text-text-tertiary mb-1">Total API Keys</p>
          <p className="text-3xl font-semibold text-text-primary">1</p>
        </div>
        <div className="p-6 rounded-xl border border-border bg-surface">
          <p className="text-sm text-text-tertiary mb-1">Status</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-teal animate-pulse-dot" />
            <span className="text-sm font-medium text-teal">Operational</span>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-8 text-center text-text-secondary">
        <div className="w-12 h-12 rounded-full bg-coral/10 text-coral flex items-center justify-center mx-auto mb-4 text-xl">⚡</div>
        <h2 className="text-lg font-medium text-text-primary mb-2">Ready to test?</h2>
        <p className="text-sm mb-6 max-w-md mx-auto">Head over to the Live Simulation tab to test transactions against the Arbitrum fork before executing on-chain.</p>
        <a href="/dashboard/simulate" className="inline-block px-4 py-2 bg-coral text-white rounded-md text-sm font-medium hover:bg-coral/90 transition-colors">
          Go to Live Simulation
        </a>
      </div>
    </div>
  );
}
