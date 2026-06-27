# ArbiSim Guard - SKILL.md

ArbiSim Guard is a pre-flight transaction simulation safety layer for AI agents.
Before any on-chain transaction executes, call `preflight_simulate` to get a
pass/fail safety verdict with full execution trace.

## MCP Tool: preflight_simulate

**When to use:** Before any transaction that moves value on-chain.
Never execute a swap, transfer, contract call, or bridge without calling this first.

**Input:**
- `network`: `"arbitrum-one"` | `"avalanche-mainnet"` | `"arbitrum-sepolia"` | `"avalanche-fuji"`
- `from_address`: string (the agent's wallet address)
- `to_address`: string (contract or recipient address)
- `value`: string (in wei, use `"0"` for ERC-20 calls)
- `data`: string (calldata hex, use `"0x"` for plain ETH transfers)

**Output:**
- `safe_to_execute`: boolean
- `flags`: string[] (human-readable risk flags)
- `gas_estimate`: number (gas units)
- `revert_reason`: string | null
- `session_id`: string (permalink: `arbisimguard.vercel.app/sim/{session_id}`)

**Decision logic:**
- `safe_to_execute: true`, no flags - execute
- `safe_to_execute: true`, flags present - execute with caution, log flags
- `safe_to_execute: false` - do not execute, surface `revert_reason` to user

## Setup

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "arbisim-guard": {
      "type": "sse",
      "url": "https://arbisim-proxy.rahulpandey-creates.workers.dev/mcp/sse?api_key=YOUR_API_KEY"
    }
  }
}
```

Get your API key at: `arbisimguard.vercel.app/dashboard/api-keys`

## Supported Networks

| Network | Chain ID | Use |
|---------|----------|-----|
| `arbitrum-one` | 42161 | Arbitrum mainnet |
| `avalanche-mainnet` | 43114 | Avalanche C-Chain mainnet |
| `arbitrum-sepolia` | 421614 | Arbitrum testnet |
| `avalanche-fuji` | 43113 | Avalanche testnet |

## Example Usage

```
Simulate a USDC transfer on Arbitrum:
- network: "arbitrum-one"
- from_address: "0xYourAgentWallet"
- to_address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" (USDC contract)
- value: "0"
- data: "0xa9059cbb000000000000000000000000RecipientAddress0000000000000000000000000000000000000000000000000de0b6b3a7640000"
```

## Safety Philosophy

ArbiSim Guard forks the chain at the current block, dry-runs the transaction in
an ephemeral Anvil instance, and discards the fork immediately. The transaction
is never broadcast. Simulation typically completes in under 5 seconds.
