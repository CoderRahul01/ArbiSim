/**
 * Circle Agent Wallet Guardrail Policy Connector
 * Integrates ArbiSim Guard's simulation engine directly into Circle Agent Wallet execution pipelines.
 */

export interface GuardrailOptions {
  endpoint?: string;
  apiKey?: string;
  useX402Nanopayments?: boolean;
  payerAddress?: string;
}

export interface CirclePolicyPayload {
  walletId?: string;
  userOp?: any;
  transaction?: any;
  chainId?: number;
  network?: string;
}

export interface PolicyCheckResult {
  approved: boolean;
  policyId: string;
  sessionId: string;
  reason: string;
  telemetry?: any;
}

export class CircleAgentWalletGuardrail {
  private endpoint: string;
  private apiKey?: string;
  private useX402: boolean;
  private payerAddress: string;

  constructor(options: GuardrailOptions = {}) {
    this.endpoint = options.endpoint || 'https://arbisimguard.com/api/v1';
    this.apiKey = options.apiKey;
    this.useX402 = options.useX402Nanopayments ?? true;
    this.payerAddress = options.payerAddress || '0x0000000000000000000000000000000000000402';
  }

  /**
   * Evaluates a transaction or UserOp payload pre-flight before broadcasting from a Circle Agent Wallet.
   */
  async evaluatePolicy(payload: CirclePolicyPayload): Promise<PolicyCheckResult> {
    const url = `${this.endpoint}/circle/policy-check`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.useX402) {
      // Construct Circle x402 Nanopayment header
      headers['X-402-Payment'] = `x402 ${this.payerAddress}:0.001:0x402_sdk_signed_${Date.now()}`;
    } else if (this.apiKey) {
      headers['X-API-Key'] = this.apiKey;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok && response.status !== 402) {
        throw new Error(`Guardrail request failed with status ${response.status}`);
      }

      const data = await response.json();
      return data as PolicyCheckResult;
    } catch (err: any) {
      console.error('CircleAgentWalletGuardrail: Policy check error:', err);
      // Fallback reject on communication error to enforce safety
      return {
        approved: false,
        policyId: 'pol_fallback_error',
        sessionId: `err_${Date.now()}`,
        reason: `Pre-flight policy check unavailable: ${err.message}`,
      };
    }
  }
}
