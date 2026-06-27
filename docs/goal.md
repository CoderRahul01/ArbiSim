# ArbiSim Guard - Goals

## Primary Goal: Circle Alliance Program

**What it is:** Circle's ecosystem program for live products built on Circle infrastructure.  
**Entry bar:** Live product using Circle's stack (USDC, Payments API, CCTP, x402, or Programmable Wallets).  
**Our qualifier:** Circle USDC as a payment method for billing (Payments API, ARB chain).  
**Apply at:** developer.circle.com/alliance

**What 1Claw did to qualify:** Arc Testnet registration, x402 USDC payments on Base, ERC-4337 via Pimlico, intents API across 8 EVM chains. ArbiSim's angle: USDC billing payments + simulation safety layer that's complementary to signing layers like 1Claw (we check if tx will succeed; they control when agent can sign).

## Secondary Goal: Ava Labs Partnership

**Status:** In contact with Matt/Andrea/Devika at Ava Labs.  
**Trigger:** Avalanche C-Chain mainnet deployment + SimulationRegistry contract verified on Routescan.  
**Message to send once mainnet is live:**
> "We're live on Avalanche C-Chain mainnet. SimulationRegistry deployed and verified. Any AI agent team in your ecosystem building on Avalanche - this is their pre-flight check. Happy to run a live demo."

**Programs to target:** Trailblazer 2.0, Avalanche ecosystem grants.

## Tertiary Goal: Public Launch

**Launch checklist:**
- [x] Studio simulation working (SAFE/REJECTED verdict)
- [x] Simulation permalink (`/sim/{sessionId}`) working
- [x] MCP SSE endpoint working (CF Worker)
- [x] Auth persistence fixed (7-day JWT, no re-login on reload)
- [x] Billing USDC payment option (Circle integration)
- [ ] SimulationRegistry deployed on Arbitrum One mainnet (needs ~$1-2 ETH)
- [ ] SimulationRegistry deployed on Avalanche C-Chain mainnet (needs ~0.05 AVAX)
- [ ] Arbitrum Audit Program application

## The River

Testnet (now) → Circle Alliance (USDC billing) → Ava Labs introduction → Arbitrum Audit Program → Mainnet contracts → Real user flow → Revenue.

ArbiSim's position relative to 1Claw: they control when the agent signs; we check whether the tx will succeed. Complementary, not competing. Both are in the AI agent security stack.
