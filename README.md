# ArbiSim Guard

A Pre-Flight AI Agent Execution & Simulation Layer built for the Arbitrum Ecosystem. It enables autonomous agent frameworks (Vibekit, Eliza) to validate multi-chain transactions and ERC-4337 UserOperations inside ephemeral, block-accurate forks one block before live settlement.

## Technical Architecture
- **API Gateway:** Node.js, TypeScript, Express.js implementing the Model Context Protocol (MCP) standard.
- **Verification Layer:** ZeroDev Smart Account verification utilizing state overrides via `ethers.js`.
- **Compute Engine:** Python 3.11 tracking multi-dimensional Arbitrum Nitro gas metrics.
- **Data Layer:** Redis/AWS SQS queuing, NeonDB state configuration, and MongoDB log storage.

## Core Moats Implemented
1. **Nitro L1 Calldata Optimization:** Compresses execution payloads using `brotli` (Quality 1) to estimate data footprint size relative to the live L2 base fee.
2. **Stylus WASM Verification:** Detects the `0xEFF000` bytecode prefix, parsing VM transitions to apply the 1:10,000 EVM-to-Ink ratio alongside a 0.84 gas Host I/O penalty.
3. **Account Abstraction Guardrails:** Intercepts `UserOperations` (v0.6/v0.7), executing `simulateValidation` to flag `sigFailed` anomalies or expired `validUntil` parameters before deployment.

---

## Getting Started

### 1. Prerequisites
- Node.js (v18+)
- Python (3.10+)
- Foundry (Anvil) installed and available on PATH

### 2. Installation & Setup
Initialize dependencies for both components:
```bash
# Install Express Gateway dependencies
npm run gateway:install

# Install Python Worker dependencies
npm run worker:install
```

Configure your environment variables:
```bash
cp .env.example .env
```

### 3. Running the Simulation Platform
Start the Gateway server and Worker daemons in separate terminal windows:

```bash
# Start the Express / MCP Gateway
npm run gateway:start

# Start the Python Queue Worker
npm run worker:start
```

### 4. Running the E2E Demo Agent
Simulate a live agent rebalance containing both failure mode verification and successful optimal route executions:
```bash
npx ts-node gateway/demo_agent.ts
```
