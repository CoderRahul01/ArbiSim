// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistryV3} from "../contracts/SimulationRegistryV3.sol";

/**
 * @notice Deploy SimulationRegistryV3.
 *
 * Usage:
 *   forge script script/DeployV3.s.sol:DeployV3 \
 *     --rpc-url $RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     -vvvv
 */
contract DeployV3 is Script {
    function run() external {
        vm.startBroadcast();

        SimulationRegistryV3 registry = new SimulationRegistryV3();
        console.log("SimulationRegistryV3 deployed at:", address(registry));

        // Seed a demo record to verify functionality
        uint32 chainId = uint32(block.chainid);
        bytes32 approvedId = keccak256("demo-approved-v3-001");
        
        // Mock evidence hash (keccak256 value representing simulated findings)
        bytes32 mockEvidenceHash = keccak256(abi.encodePacked("mock-evidence"));

        registry.logSimulation(
            approvedId,
            msg.sender,
            bytes32(0),
            true,
            0,
            21000,
            "",
            chainId,
            mockEvidenceHash
        );
        console.log("Demo approved simulation logged with evidenceHash");

        vm.stopBroadcast();
    }
}
