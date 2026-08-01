# Frontend Redesign & Brand Specification (Anteratic Labs)

This specification outlines the visual, structural, and narrative overhaul for the **ArbiSim Guard** landing page and dashboard, directly addressing the 4 core findings from the **Andrew Joe Frontend Review**.

---

## 1. Objectives & Positioning

- **Brand Entity**: Positioned under **Anteratic Labs** as a neutral, multi-chain pre-flight security layer.
- **Ecosystem Focus**: Primary emphasis on **Avalanche**, **Injective**, **Solana**, and **Arbitrum** using official high-resolution vector logos (no grant text).
- **Core Value**: Transition from template aesthetics to a high-credibility, dark-luxury AI finance platform.

---

## 2. Resolving Andrew Joe's 4 Review Points

### 🎯 Finding 1: "Feels generic, not premium"
* **Action**: Eliminate standard emoji-style icons and basic cards.
* **Design System Upgrade**:
  * **Typography**: Modern typography stack utilizing Google Fonts `Outfit` for bold headers and `Inter` for clean tabular data.
  * **Color Palette**: Rich dark background (`#0A0D14`), sleek slate card borders (`rgba(255, 255, 255, 0.08)`), subtle accent glow gradients (Emerald `#10B981` for APPROVED, Crimson `#EF4444` for REJECTED, Indigo `#6366F1` for primary CTAs).
  * **Icons**: Replace browser/emoji icons with custom, crisp Lucide SVG vector icons (`ShieldCheck`, `Cpu`, `Zap`, `Network`, `Lock`).

---

### 🎯 Finding 2: "Explains more than it shows"
* **Action**: Move from static text descriptions to live, interactive product previews above the fold.
* **Hero Section Interactive Simulator**:
  * Include an embedded live execution sandbox directly on the home page hero.
  * Users can select a network (`Avalanche`, `Injective`, `Solana`, `Arbitrum`), choose a sample AI agent strategy (e.g., "Dex Arbitrage Swap", "UserOp Session Key Execution"), and hit **Run Pre-Flight Check**.
  * Displays real-time terminal output, gas trace breakdowns, MEV risk meters, and instantaneous APPROVED/REJECTED receipts under 800ms.

---

### 🎯 Finding 3: "Build trust early"
* **Action**: Feature prominent trust signals immediately above and below the fold.
* **Supported Chains Matrix**:
  * Clean, official brand logos for **Avalanche**, **Injective**, **Solana**, and **Arbitrum**.
  * Live status indicators ("100% RPC Uptime", "Block-pinned ephemeral Anvil forks", "Pyth & Chainlink Oracles active").
  * Cryptographic Verification Badge: Highlight on-chain proof receipt verifiability (`SimulationRegistryV3.sol`).

---

### 🎯 Finding 4: "Create a clear visual flow"
* **Action**: Structure the landing page into 5 distinct, high-converting vertical zones:

1. **Hero Zone**: High-impact headline ("AI agents handle real money. Verify every transaction before it touches mainnet.") + Interactive Simulator Playground.
2. **Ecosystem & Chain Grid**: Clean brand logos for Avalanche, Injective, Solana, Arbitrum + live network telemetry stats.
3. **How It Works (3 Steps)**:
   - **Step 1: Intercept Payload** (Agent passes raw tx or ERC-4337 UserOp).
   - **Step 2: Ephemeral Fork Execution** (Forked execution at current block head with gas, MEV, WASM, and P&L analysis).
   - **Step 3: Instant Verdict** (Receive APPROVED/REJECTED verdict + cryptographic receipt).
4. **Developer Integration**: Code snippets for REST API, Node/Python SDK, and 1-click MCP Server setup for Eliza, Vibekit, and LangGraph.
5. **Footer & Governance**: Anteratic Labs entity notice, API key onboarding CTA, and link to documentation.
