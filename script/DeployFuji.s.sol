// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../contracts/SimulationRegistry.sol";
import {MockERC8004Registry} from "../contracts/MockERC8004Registry.sol";

/**
 * @notice Deploy ArbiSim Guard contracts to Avalanche Fuji Testnet.
 *
 * Deploys:
 *   1. SimulationRegistry   — immutable audit trail of simulation verdicts
 *   2. MockERC8004Registry  — agent identity + reputation registry (Speedrun demo)
 *
 * After deploy, copy the addresses into .env:
 *   AVALANCHE_FUJI_REGISTRY=<SimulationRegistry address>
 *   ERC8004_REGISTRY_FUJI=<MockERC8004Registry address>
 *
 * Usage:
 *   forge script script/DeployFuji.s.sol:DeployFuji \
 *     --rpc-url $AVALANCHE_FUJI_RPC \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 */
contract DeployFuji is Script {

    // Demo agent addresses — one with high reputation, one unregistered
    address constant TRUSTED_AGENT    = 0x742d35CC6634C0532925a3b8a4BC454E4438f44E;
    address constant LOW_REP_AGENT    = 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF;

    function run() external {
        vm.startBroadcast();

        // ── 1. SimulationRegistry ────────────────────────────────────────────
        SimulationRegistry registry = new SimulationRegistry();
        console.log("SimulationRegistry deployed at:", address(registry));

        // Seed with a demo APPROVED simulation (proves the contract works)
        bytes32 sampleApproved = keccak256("avax-fuji-demo-approved-001");
        registry.logSimulation(sampleApproved, true, 450000000000000, "", 0x00);
        console.log("Demo APPROVED simulation logged");

        // Seed with a demo REJECTED simulation (ERC-8004 flag set)
        bytes32 sampleRejected = keccak256("avax-fuji-demo-rejected-001");
        registry.logSimulation(
            sampleRejected,
            false,
            0,
            "x402 payment rejected: payee has low ERC-8004 reputation score (12/100)",
            0x80  // FLAG_LOW_AGENT_REPUTATION (bit 7)
        );
        console.log("Demo REJECTED simulation (low reputation) logged");

        console.log("SimulationRegistry total simulations:", registry.totalSimulations());

        // ── 2. MockERC8004Registry ───────────────────────────────────────────
        MockERC8004Registry erc8004 = new MockERC8004Registry();
        console.log("MockERC8004Registry deployed at:", address(erc8004));

        // Register a trusted agent (high reputation — payments to this agent are SAFE)
        erc8004.registerAgent(TRUSTED_AGENT, 92);
        console.log("Trusted agent registered with score 92:", TRUSTED_AGENT);

        // Register a low-reputation agent (triggers FLAG_LOW_AGENT_REPUTATION)
        erc8004.registerAgent(LOW_REP_AGENT, 12);
        console.log("Low-rep agent registered with score 12:", LOW_REP_AGENT);

        // Deployer itself gets a perfect score (useful for self-testing)
        erc8004.registerAgent(msg.sender, 100);
        console.log("Deployer registered with score 100:", msg.sender);

        console.log("Total registered agents:", erc8004.totalAgents());

        vm.stopBroadcast();

        // ── Summary ──────────────────────────────────────────────────────────
        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("Chain: Avalanche Fuji Testnet (43113)");
        console.log("SimulationRegistry:", address(registry));
        console.log("MockERC8004Registry:", address(erc8004));
        console.log("\nAdd to .env:");
        console.log("AVALANCHE_FUJI_REGISTRY=", address(registry));
        console.log("ERC8004_REGISTRY_FUJI=", address(erc8004));
        console.log("\nTrusted agent (score 92):", TRUSTED_AGENT);
        console.log("Low-rep agent (score 12):", LOW_REP_AGENT);
    }
}
