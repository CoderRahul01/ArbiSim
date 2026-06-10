// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimulationRegistry
 * @notice Immutable on-chain log of ArbiSim Guard pre-flight simulation results.
 *         Each record maps a session ID to its outcome, gas cost, and timestamp.
 *         Deployed on Arbitrum Sepolia for the Open House London Buildathon.
 */
contract SimulationRegistry {
    struct SimulationRecord {
        bytes32 sessionId;
        bool passed;
        uint256 gasCostWei;
        string revertReason;
        uint256 timestamp;
        address reporter;
    }

    mapping(bytes32 => SimulationRecord) public records;
    bytes32[] public sessionIds;

    address public owner;

    event SimulationLogged(
        bytes32 indexed sessionId,
        bool passed,
        uint256 gasCostWei,
        string revertReason,
        uint256 timestamp
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Log a simulation result on-chain.
     * @param sessionId  UUID of the simulation session (as bytes32)
     * @param passed     true if simulation was APPROVED, false if REJECTED
     * @param gasCostWei total L2+L1 gas cost in wei
     * @param revertReason  empty if passed, error string if rejected
     */
    function logSimulation(
        bytes32 sessionId,
        bool passed,
        uint256 gasCostWei,
        string calldata revertReason
    ) external onlyOwner {
        require(records[sessionId].timestamp == 0, "Already logged");
        records[sessionId] = SimulationRecord({
            sessionId: sessionId,
            passed: passed,
            gasCostWei: gasCostWei,
            revertReason: revertReason,
            timestamp: block.timestamp,
            reporter: msg.sender
        });
        sessionIds.push(sessionId);
        emit SimulationLogged(sessionId, passed, gasCostWei, revertReason, block.timestamp);
    }

    function getRecord(bytes32 sessionId) external view returns (SimulationRecord memory) {
        return records[sessionId];
    }

    function totalSimulations() external view returns (uint256) {
        return sessionIds.length;
    }
}
