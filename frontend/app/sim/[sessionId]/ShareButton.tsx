'use client';

import { useState } from 'react';

export default function ShareButton({ sessionId, siteUrl }: { sessionId: string; siteUrl: string }) {
  const [copied, setCopied] = useState(false);
  const url = `${siteUrl}/sim/${sessionId}`;

  const copy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={copy}
      className="px-4 py-2.5 text-sm font-medium border border-border rounded-lg text-text-secondary hover:text-text-primary hover:bg-elevated transition-all duration-150"
    >
      {copied ? 'Link copied' : 'Share'}
    </button>
  );
}
