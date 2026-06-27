'use client';

import { useEffect } from 'react';

const CF_WORKER_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

export default function ViewTracker({ sessionId }: { sessionId: string }) {
  useEffect(() => {
    fetch(`${CF_WORKER_URL}/api/v1/sim/public/${sessionId}/view`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(res => res.json())
      .then(data => {
        console.log('[ViewTracker] View logged:', data);
      })
      .catch(err => {
        console.error('[ViewTracker] Failed to log view:', err);
      });
  }, [sessionId]);

  return null;
}
