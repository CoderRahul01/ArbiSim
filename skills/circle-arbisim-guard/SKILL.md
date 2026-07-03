---
name: circle-arbisim-guard
description: Official pre-flight simulation and execution safety guardrail skill for Circle Agent Stack (Agent Wallets, Circle CLI, and x402 Nanopayments).
---

# Circle ArbiSim Guard Skill

Empower your AI agents operating **Circle Agent Wallets** to simulate every on-chain transaction or UserOp before signing or broadcasting. 

ArbiSim Guard intercepts transaction payloads, executes them in a block-accurate ephemeral fork, and returns an `APPROVED` or `REJECTED` verdict with complete telemetry on gas costs, slippage, session key validity, and MEV sandwich risks.

## Features

- **Pre-Flight Simulation for Circle Agent Wallets**: Validate transactions off-chain before committing agent funds.
- **Circle x402 Agent Nanopayments**: Gasless, sub-cent USDC pay-per-request monetization for simulation APIs.
- **USDC Security Shield**: Detect high slippage, missing liquidity, or malicious draining contracts targeting USDC balances.
- **Session Key Protection**: Verify ERC-4337 UserOp signatures and time-expiration bounds (`validUntil`).

## Quickstart

### 1. Installation via Circle CLI

```bash
circle skill install arbisim-guard
```

### 2. Usage with Circle Agent Wallets

```typescript
import { CircleAgentWalletGuardrail } from './policy_connector';

const guard = new CircleAgentWalletGuardrail({
  endpoint: 'https://arbisimguard.com/api/v1',
  useX402Nanopayments: true,
});

// Intercept payload before calling wallet.signTransaction()
const policyResult = await guard.evaluatePolicy({
  walletId: 'circle_agent_wallet_123',
  network: 'arbitrum-one',
  transaction: {
    to: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', // USDC contract
    data: '0xa9059cbb...',
    value: '0x0',
  },
});

if (policyResult.approved) {
  console.log('✅ Simulation APPROVED:', policyResult.reason);
  // Proceed with Circle Wallet signing
} else {
  console.error('❌ Simulation REJECTED:', policyResult.reason);
  // Abort execution to protect capital
}
```

## API Specification

- **Policy Endpoint**: `POST https://arbisimguard.com/api/v1/circle/policy-check`
- **Simulation Endpoint**: `POST https://arbisimguard.com/api/v1/simulate`
- **Headers**:
  - `X-402-Payment`: `x402 <payerAddress>:<amountUsdc>:<signature>` (for Circle x402 Nanopayments)
  - `X-API-Key`: `ask_free_...` or `ask_pro_...` (for standard key authentication)
