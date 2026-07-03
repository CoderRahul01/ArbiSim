import Link from 'next/link';
import { ReactNode } from 'react';

const navSections = [
  { title: 'Getting Started', links: [
    { href: '/docs', label: 'What is ArbiSim?' },
    { href: '/docs/agent-studio', label: 'Agent Studio & Stress Testing' },
    { href: '/docs/quickstart', label: 'Quickstart (5 min)' },
  ]},
  { title: 'How It Works', links: [
    { href: '/docs/how-it-works', label: 'Overview' },
    { href: '/docs/what-it-checks', label: 'What it checks' },
    { href: '/docs/chains', label: 'Supported chains' },
  ]},
  { title: 'Integrations', links: [
    { href: '/docs/circle', label: 'Circle Agent Stack (x402)' },
    { href: '/docs/mcp', label: 'MCP agents (Claude, Cursor)' },
    { href: '/docs/rest-api', label: 'REST API' },
    { href: '/docs/frameworks', label: 'Vibekit, Eliza, LangGraph' },
  ]},
  { title: 'Architecture', links: [
    { href: '/docs/architecture', label: 'System overview' },
    { href: '/docs/data-flow', label: 'Request lifecycle' },
  ]},
  { title: 'Troubleshooting', links: [
    { href: '/docs/troubleshooting', label: 'Common errors' },
    { href: '/docs/troubleshooting/rpc', label: 'RPC & fork issues' },
    { href: '/docs/troubleshooting/mcp-setup', label: 'MCP setup issues' },
  ]},
];

export default function DocsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-base">
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/60 bg-base/90 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="ArbiSim Guard" width={22} height={22} className="rounded" />
              <span className="font-semibold text-text-primary text-sm">ArbiSim Guard</span>
            </Link>
            <span className="text-border">/</span>
            <span className="text-text-secondary text-sm font-medium">Docs</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <Link href="/" className="text-text-secondary hover:text-text-primary transition-colors">Home</Link>
            <Link href="/dashboard/simulate" className="px-3 py-1.5 rounded-md bg-coral text-white text-xs font-medium hover:bg-coral/90 transition-colors">
              Open Dashboard →
            </Link>
          </div>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto flex pt-14">
        <aside className="hidden lg:block w-64 flex-shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] overflow-y-auto border-r border-border py-8 pr-4 pl-6">
          <nav className="space-y-6">
            {navSections.map((section) => (
              <div key={section.title}>
                <p className="text-xs font-mono text-text-tertiary uppercase tracking-widest mb-2 px-3">{section.title}</p>
                <ul className="space-y-0.5">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className="block px-3 py-1.5 rounded-md text-sm text-text-secondary hover:text-text-primary hover:bg-elevated transition-all duration-150">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div className="mt-4 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-xs text-red-400 font-mono mb-1">🔴 Supported by Ava Labs</p>
              <p className="text-xs text-text-tertiary leading-relaxed">Retro9000 grant program. BD support from the Avalanche ecosystem team.</p>
            </div>
          </nav>
        </aside>
        <main className="flex-1 min-w-0 px-8 py-12 max-w-3xl">
          {children}
        </main>
      </div>
    </div>
  );
}
