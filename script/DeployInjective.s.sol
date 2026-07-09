// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistryV3} from "../contracts/SimulationRegistryV3.sol";

/**
 * @notice Deploy SimulationRegistryV3 to the Injective EVM Testnet (Chain ID: 1439).
 *
 * This gives ArbiSim Guard an independently verifiable on-chain simulation record
 * on the exact chain being pitched to Injective — the same proof-of-work pattern
 * used for Avalanche Fuji.
 *
 * Prerequisites:
 *   1. Get testnet INJ from https://testnet.faucet.injective.network
 *   2. Set DEPLOYER_PRIVATE_KEY in your environment (or use a Foundry keystore)
 *
 * Usage:
 *   forge script script/DeployInjective.s.sol:DeployInjective \
 *     --rpc-url https://k8s.testnet.json-rpc.injective.network/ \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 *
 * After deploy:
 *   1. Copy the deployed address from the output.
 *   2. Set INJECTIVE_TESTNET_REGISTRY=<address> in your .env file.
 *   3. Verify on https://testnet.blockscout.injective.network — this is your proof tx.
 *
 * Note: Injective EVM uses EIP-1559. Gas costs are sub-cent. No special flags needed.
 * Note: The SimulationRegistryV3 contract is chain-agnostic — no changes required.
 */
contract DeployInjective is Script {
    function run() external {
        vm.startBroadcast();

        SimulationRegistryV3 registry = new SimulationRegistryV3();
        console.log("SimulationRegistryV3 deployed on Injective EVM Testnet at:", address(registry));
        console.log("Chain ID:", block.chainid);  // Should print 1439

        // Seed a demo record to confirm the registry is live and writable
        uint32 chainId = uint32(block.chainid);
        bytes32 demoSessionId = keccak256("injective-testnet-demo-v3-001");
        bytes32 demoEvidenceHash = keccak256(abi.encodePacked("injective-demo-evidence"));

        registry.logSimulation(
            demoSessionId,
            msg.sender,
            bytes32(0),
            true,            // safeToExecute
            0,               // flagsBitmap — clean demo verdict
            21000,           // gasEstimate
            "",              // no revert reason
            chainId,
            demoEvidenceHash
        );

        console.log("Demo simulation logged. Session ID:");
        console.logBytes32(demoSessionId);
        console.log("Evidence hash:");
        console.logBytes32(demoEvidenceHash);
        console.log("--");
        console.log("Next steps:");
        console.log("  1. Set INJECTIVE_TESTNET_REGISTRY=", address(registry), "in .env");
        console.log("  2. Verify on https://testnet.blockscout.injective.network");

        vm.stopBroadcast();
    }
}
