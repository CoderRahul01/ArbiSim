# Circle Agent Stack Integration Guide — ArbiSim Guard

ArbiSim Guard provides **Pre-Flight Execution Simulation & Security Guardrails** for **Circle Agent Wallets**, **Circle CLI**, and **Circle Agent Nanopayments (x402)**.

---

## 1. System Overview

Autonomous AI agents executing financial transactions on behalf of users must be protected against:
- **Capital Loss from Reverts**: Unhandled contract logic errors or expired session keys.
- **Slippage & MEV Attacks**: Unfavorable price execution on DEX swaps.
- **Malicious Contracts**: Draining approvals or target contract spoofing.

ArbiSim Guard acts as a pre-flight execution barrier: before a Circle Agent Wallet signs or broadcasts an on-chain transaction or UserOp, ArbiSim Guard simulates the payload on an ephemeral block-accurate fork and returns a verified `APPROVED` or `REJECTED` status.

```
+------------------+         1. Check Policy          +-----------------------+
| Circle Agent     | -------------------------------> | ArbiSim Guard         |
| Wallet           |                                  | Policy Engine         |
|                  | <------------------------------- | (x402 Verified)       |
+------------------+         2. APPROVED / REJECTED   +-----------------------+
        |                                                        |
        | 3. Broadcast if Approved                               v
        v                                             +-----------------------+
+------------------+                                  | Ephemeral Anvil Fork  |
| Arbitrum / Arc   |                                  | (Arbitrum / Arc RPC)  |
| Mainnet          |                                  +-----------------------+
+------------------+
```

---

## 2. Circle x402 Agent Nanopayments

ArbiSim Guard natively supports **Circle x402 Agent Nanopayments** via `@circle-fin/x402-batching`, allowing AI agents to pay per simulation request ($0.001 USDC) gaslessly and on-demand without registering for traditional API keys.

### Request Format
Agents attach the `X-402-Payment` header to requests sent to `/api/v1/simulate` or `/api/v1/circle/policy-check`:

```http
POST /api/v1/circle/policy-check HTTP/1.1
Host: api.arbisimguard.com
Content-Type: application/json
X-402-Payment: x402 0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1:0.001:0x402_sig_12345
```

### Response Format (HTTP 402 if unauthenticated)
If an unauthenticated agent requests a simulation, ArbiSim Guard returns `402 Payment Required` with Circle x402 batching metadata:

```json
{
  "error": "Payment Required",
  "status": 402,
  "x402": {
    "pricePerRequestUsdc": "0.001",
    "recipient": "0x9eA8B065a624DF44CaB6C8cae74a22e07e29f2f1",
    "supportedChains": ["arbitrum-one", "arbitrum-sepolia", "arc-testnet"],
    "instructions": "Attach header `X-402-Payment: x402 <payerAddress>:<amount>:<signatureOrTx>` or use official @circle-fin/x402-batching client."
  }
}
```

---

## 3. Circle Skill Integration (`arbisim-guard`)

AI agents running on **Circle CLI**, **Claude Code**, **Cursor**, or **OpenClaw** can install the open-source ArbiSim Guard skill:

```bash
circle skill install arbisim-guard
```

### TypeScript Integration

```typescript
import { CircleAgentWalletGuardrail } from './policy_connector';

const guardrail = new CircleAgentWalletGuardrail({
  endpoint: 'https://api.arbisimguard.com/api/v1',
  useX402Nanopayments: true,
});

const policy = await guardrail.evaluatePolicy({
  walletId: 'circle_wallet_agent_01',
  network: 'arbitrum-one',
  transaction: {
    to: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    data: '0xa9059cbb...',
  },
});

if (!policy.approved) {
  throw new Error(`Execution aborted by ArbiSim Guard: ${policy.reason}`);
}
```

---

## 4. Circle Developer Grant Roadmap & Milestones

### Milestone 1: Circle Agent Wallet Pre-Flight Policy Integration (Testnet Pilot)
- **Objective:** Deploy and refine the pre-flight policy engine (`/api/v1/circle/policy-check`) across Circle Programmable Wallets.
- **Deliverables:**
  - Full support for ERC-4337 UserOp validation and single/batch transaction simulation on Arbitrum Sepolia and Arc Testnet.
  - Complete SDK middleware package for agent frameworks (OpenClaw, Eliza, LangGraph).
- **Target Timeline:** 4 Weeks

### Milestone 2: Multi-Agent USDC Protection & MEV Shield
- **Objective:** Implement advanced telemetry for USDC transaction security and frontrunning prevention.
- **Deliverables:**
  - Automated MEV sandwich risk detection and slippage guardrails for DEX swaps targeting USDC liquidity pools.
  - On-chain simulation audit trail logging on `SimulationRegistry` smart contracts.
- **Target Timeline:** 6 Weeks

### Milestone 3: Mainnet Ecosystem Launch & Marketplace Expansion
- **Objective:** Production rollout on Arbitrum Mainnet & Arc Mainnet with active Circle Agent Marketplace integration.
- **Deliverables:**
  - Public dashboard at `arbisimguard.com` with real-time pre-flight simulation telemetry, failure analytics, and API management.
  - Pilot onboarding with 5+ AI agent builders and wallet providers in the Circle ecosystem.
- **Target Timeline:** 6 Weeks
