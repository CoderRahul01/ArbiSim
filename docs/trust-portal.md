# ArbiSim Guard — Trust Portal & Verification Layer

Pre-flight DeFi simulations are critical for AI agents, but they must be auditable. ArbiSim Guard implements a public Trust Portal and cryptographic validation protocol to bridge the trust gap.

## 1. On-Chain Simulation Registries

Every pre-flight simulation logs its safety verdict on-chain. This ensures that safety audits are immutable, persistent, and verifiable by third parties.

* **Avalanche Fuji Testnet (v3)**: `0xe940d0f71718F3deaff790d7DC53C775B07E3c54`
* **Arbitrum Sepolia (v2 fallback)**: `0x5Dfd08c3d44BEBfa61a24Af8c2EfbDB5A01dFA32`

### The V3 Evidence Binding
On version 3 contracts, simulation logging includes a Keccak-256 hash of the complete, sorted safety findings (`evidenceHash`).

## 2. Public Trust Feed

The feed is hosted at `/trust` and serves as a public transparency dashboard.

* **Total Attestations**: Real-time counter of total simulated txs logged across all networks.
* **Per-Chain Counters**: Segmented stats showing active agent traffic.
* **Verdict Stream**: List of recent simulation sessions, their agents, execution flags, and registry transaction links.
* **Performance Cache**: A server-side 30s cache protects the endpoints from rate limits under high traffic.

## 3. Client-Side Cryptographic Verification

When visiting `/trust/[sessionId]`, the browser performs an independent audit:
1. **Fetch off-chain data**: Fetches the structured `evidenceReport` and the logged `evidenceHash` from the unauthenticated public API:
   `GET /api/v1/verdicts/{sessionId}/evidence`
2. **Fetch on-chain records**: Queries the `SimulationRegistry` smart contract directly via JSON-RPC to retrieve the logged `evidenceHash` and `safeToExecute` verdict.
3. **Browser Hash Recalculation**: Recalculates the Keccak-256 hash of the returned `evidenceReport` using browser-side libraries.
4. **Validation Check**:
   * Confirms the recalculated hash matches the `evidenceHash` returned by the API.
   * Confirms the API hash matches the immutable `evidenceHash` logged on-chain.
   * Displays a **Verified On-Chain (v3)** badge and green safety shield when all checks pass.

## 4. Public Evidence Audit API

Retrieve simulation audit proof directly without passing through UI dashboards:

### `GET /api/v1/verdicts/{sessionId}/evidence`

Returns details for the simulation session:

#### Request Parameters
| Parameter | Type | Required | Description |
|---|---|---|---|
| `sessionId` | `string` (UUID) | Yes | The simulation ID |

#### Example Response (`200 OK`)
```json
{
  "sessionId": "3255a66e-3bf6-457c-b278-37ba1b32b1ec",
  "network": "avalanche-fuji",
  "status": "APPROVED",
  "evidenceReport": [
    {
      "flag": "low_reputation",
      "label": "Low Payee Reputation",
      "source": "ERC-8004 On-chain Reputation Registry",
      "finding": "Payee address 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 has low reputation score (0) in the registry",
      "severity": "high"
    }
  ],
  "evidenceHash": "0x4aec3d2b10b3f2976f307a9bf3ae88f0c3fc06b19c1371fad413fdc1119825fa",
  "onchainTxHash": "0x51df2d27289bb410553e2d5b1accd3f73a203bcf6b57f91d0e62e289333c8681",
  "createdAt": "2026-07-08T02:13:45.963Z"
}
```
