import Link from 'next/link';

export default function SimNotFound() {
  return (
    <div className="min-h-screen bg-base flex flex-col items-center justify-center px-6 text-center">
      <p className="text-xs font-mono text-text-tertiary mb-3">404</p>
      <h1 className="text-2xl font-semibold text-text-primary mb-2">Simulation not found</h1>
      <p className="text-sm text-text-secondary mb-8 max-w-sm">
        This simulation ID doesn&apos;t exist or hasn&apos;t completed yet.
      </p>
      <Link
        href="/dashboard"
        className="px-5 py-2.5 bg-coral text-white rounded-lg font-medium text-sm hover:bg-coral/90 transition-all duration-200 shadow-lg shadow-coral/25"
      >
        Go to dashboard
      </Link>
    </div>
  );
}
