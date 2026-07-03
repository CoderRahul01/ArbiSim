// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../contracts/SimulationRegistry.sol";

/**
 * @notice Deploy SimulationRegistry v2 to Avalanche C-Chain Mainnet (43114).
 *
 * Usage:
 *   forge script script/DeployAvalancheMainnet.s.sol:DeployAvalancheMainnet \
 *     --rpc-url https://api.avax.network/ext/bc/C/rpc \
 *     --private-key $REGISTRY_SIGNER_KEY \
 *     --broadcast
 */
contract DeployAvalancheMainnet is Script {
    uint32 constant AVALANCHE_MAINNET_CHAIN_ID = 43114;

    function run() external {
        vm.startBroadcast();

        SimulationRegistry registry = new SimulationRegistry();
        console.log("SimulationRegistry deployed on Avalanche Mainnet at:", address(registry));
        console.log("Owner / initial reporter:", registry.owner());

        // Sample APPROVED simulation — proves contract is live on Avalanche C-Chain
        bytes32 approvedId = keccak256("demo-avax-approved-v1");
        registry.logSimulation(
            approvedId,
            msg.sender,                 // agent
            bytes32(0),                 // txHash
            true,                       // safeToExecute
            0,                          // no flags
            150_000,                    // gasEstimate
            "",                         // no revert reason
            AVALANCHE_MAINNET_CHAIN_ID
        );
        console.log("Sample APPROVED simulation logged on Avalanche mainnet");

        vm.stopBroadcast();
    }
}
