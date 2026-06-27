// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../contracts/SimulationRegistry.sol";
import {MockERC8004Registry} from "../contracts/MockERC8004Registry.sol";

/**
 * @notice Deploy ArbiSim Guard contracts to Avalanche Fuji Testnet.
 *
 * Deploys:
 *   1. SimulationRegistry v2  — immutable audit trail of simulation verdicts
 *   2. MockERC8004Registry    — agent identity + reputation registry
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
    uint32 constant FUJI_CHAIN_ID = 43113;

    address constant TRUSTED_AGENT = 0x742d35CC6634C0532925a3b8a4BC454E4438f44E;
    address constant LOW_REP_AGENT = 0xDeaDbeefdEAdbeefdEadbEEFdeadbeEFdEaDbeeF;

    function run() external {
        vm.startBroadcast();

        // ── 1. SimulationRegistry ────────────────────────────────────────────
        SimulationRegistry registry = new SimulationRegistry();
        console.log("SimulationRegistry v2 deployed at:", address(registry));

        // Seed: APPROVED simulation
        bytes32 approvedId = keccak256("avax-fuji-demo-approved-v2-001");
        registry.logSimulation(
            approvedId,
            msg.sender,
            bytes32(0),
            true,
            0,
            450_000,
            "",
            FUJI_CHAIN_ID
        );
        console.log("Demo APPROVED simulation logged");

        // Seed: REJECTED simulation — FLAG_LOW_REPUTATION | FLAG_UNKNOWN_AGENT
        bytes32 rejectedId = keccak256("avax-fuji-demo-rejected-v2-001");
        registry.logSimulation(
            rejectedId,
            LOW_REP_AGENT,
            bytes32(0),
            false,
            uint16(registry.FLAG_LOW_REPUTATION()) | uint16(registry.FLAG_UNKNOWN_AGENT()),
            0,
            "x402 payment rejected: payee has low ERC-8004 reputation score (12/100)",
            FUJI_CHAIN_ID
        );
        console.log("Demo REJECTED simulation (low reputation) logged");

        console.log("SimulationRegistry total simulations:", registry.totalSimulations());

        // ── 2. MockERC8004Registry ───────────────────────────────────────────
        MockERC8004Registry erc8004 = new MockERC8004Registry();
        console.log("MockERC8004Registry deployed at:", address(erc8004));

        erc8004.registerAgent(TRUSTED_AGENT, 92);
        console.log("Trusted agent registered (score 92):", TRUSTED_AGENT);

        erc8004.registerAgent(LOW_REP_AGENT, 12);
        console.log("Low-rep agent registered (score 12):", LOW_REP_AGENT);

        erc8004.registerAgent(msg.sender, 100);
        console.log("Deployer registered (score 100):", msg.sender);

        console.log("Total registered agents:", erc8004.totalAgents());

        vm.stopBroadcast();

        console.log("\n=== DEPLOYMENT COMPLETE ===");
        console.log("Chain: Avalanche Fuji Testnet (43113)");
        console.log("SimulationRegistry:", address(registry));
        console.log("MockERC8004Registry:", address(erc8004));
        console.log("\nAdd to .env:");
        console.log("AVALANCHE_FUJI_REGISTRY=", address(registry));
        console.log("ERC8004_REGISTRY_FUJI=", address(erc8004));
    }
}
