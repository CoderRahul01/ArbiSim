// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../contracts/SimulationRegistry.sol";

/**
 * @notice Deploy SimulationRegistry v2 to Arbitrum One mainnet.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeploySimulationRegistry \
 *     --rpc-url $ARBITRUM_ONE_RPC \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $ARBISCAN_API_KEY
 */
contract DeploySimulationRegistry is Script {
    uint32 constant ARBITRUM_ONE_CHAIN_ID = 42161;

    function run() external {
        vm.startBroadcast();

        SimulationRegistry registry = new SimulationRegistry();
        console.log("SimulationRegistry v2 deployed at:", address(registry));
        console.log("Owner / initial reporter:", registry.owner());

        // Sample APPROVED simulation — proves contract is live
        bytes32 approvedId = keccak256("demo-approved-v2-001");
        registry.logSimulation(
            approvedId,
            msg.sender,                 // agent
            bytes32(0),                 // txHash (demo — no real tx)
            true,                       // safeToExecute
            0,                          // no flags
            180_000,                    // gasEstimate
            "",                         // no revert reason
            ARBITRUM_ONE_CHAIN_ID
        );
        console.log("Sample APPROVED simulation logged:", uint256(approvedId));

        // Sample REJECTED simulation — FLAG_REVERT | FLAG_HIGH_SLIPPAGE
        bytes32 rejectedId = keccak256("demo-rejected-v2-001");
        registry.logSimulation(
            rejectedId,
            msg.sender,
            bytes32(0),
            false,
            uint16(registry.FLAG_REVERT()) | uint16(registry.FLAG_HIGH_SLIPPAGE()),
            0,
            "execution_reverted: insufficient output amount",
            ARBITRUM_ONE_CHAIN_ID
        );
        console.log("Sample REJECTED simulation logged:", uint256(rejectedId));

        console.log("Total simulations logged:", registry.totalSimulations());

        vm.stopBroadcast();
    }
}
