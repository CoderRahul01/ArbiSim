const BASE_URL = process.env.NEXT_PUBLIC_CF_WORKER_URL ?? 'https://arbisim-proxy.rahulpandey-creates.workers.dev';

export interface SimulateRequest {
  network: 'arbitrum-one' | 'arbitrum-sepolia' | 'robinhood-chain-testnet';
  agent_address: string;
  transactions: Array<{ to: string; data: string; value: string; gasLimit?: string }>;
  max_slippage_tolerance: number;
  userOp?: object;
  entrypointVersion?: 'v0.6' | 'v0.7';
}

export interface SimulationResponse {
  status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'ERROR';
  session_id?: string;
  sessionId?: string;
  [key: string]: unknown;
}

export async function simulate(req: SimulateRequest, apiKey: string): Promise<SimulationResponse> {
  const res = await fetch(`${BASE_URL}/api/v1/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
    body: JSON.stringify(req),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<SimulationResponse>;
}

export async function pollStatus(sessionId: string, apiKey: string, maxAttempts = 30): Promise<SimulationResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const res = await fetch(`${BASE_URL}/api/v1/simulate/${sessionId}`, {
      headers: { 'X-API-Key': apiKey },
    }).catch(() => null);
    if (!res?.ok) continue;
    const data = await res.json() as SimulationResponse;
    if (data.status !== 'PENDING') return data;
  }
  throw new Error('Simulation timed out after 30 seconds.');
}
