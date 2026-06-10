// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {SimulationRegistry} from "../contracts/SimulationRegistry.sol";

/**
 * @notice Deploy SimulationRegistry to Arbitrum Sepolia.
 *
 * Usage:
 *   forge script script/Deploy.s.sol:DeploySimulationRegistry \
 *     --rpc-url $ARBITRUM_SEPOLIA_RPC \
 *     --private-key $DEPLOYER_PRIVATE_KEY \
 *     --broadcast \
 *     --verify \
 *     --etherscan-api-key $ARBISCAN_API_KEY
 */
contract DeploySimulationRegistry is Script {
    function run() external {
        vm.startBroadcast();

        SimulationRegistry registry = new SimulationRegistry();

        console.log("SimulationRegistry deployed at:", address(registry));
        console.log("Owner:", registry.owner());

        // Log a sample APPROVED simulation to prove the contract works
        bytes32 sampleId = keccak256("demo-approved-001");
        registry.logSimulation(
            sampleId,
            true,        // passed = APPROVED
            213000000000000, // 0.000213 ETH gas cost
            "",          // no revert reason
            0            // no flags fired
        );
        console.log("Sample APPROVED simulation logged:", uint256(sampleId));

        // Log a sample REJECTED simulation
        bytes32 rejectedId = keccak256("demo-rejected-001");
        registry.logSimulation(
            rejectedId,
            false,       // passed = REJECTED
            0,           // no gas spent (reverted)
            "execution_reverted: insufficient output amount",
            0x01 | 0x02  // FLAG_EXECUTION_REVERTED | FLAG_HIGH_SLIPPAGE
        );
        console.log("Sample REJECTED simulation logged:", uint256(rejectedId));

        console.log("Total simulations logged:", registry.totalSimulations());

        vm.stopBroadcast();
    }
}
