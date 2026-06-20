// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockERC8004Registry
 * @notice Minimal on-chain reputation registry for AI agents.
 *         Inspired by ERC-8004 (agent identity + reputation standard).
 *         Used by ArbiSim Guard to flag low/unregistered payees in x402 payment safety reports.
 *
 * @dev Deployed on Avalanche Fuji testnet for the ArbiSim Guard Speedrun demo.
 *      The owner registers agents and sets their reputation scores (0-100).
 *      ArbiSim Guard queries `getReputation(agent)` inside the Anvil fork to decide
 *      whether to raise FLAG_LOW_AGENT_REPUTATION in the safety report.
 */
contract MockERC8004Registry is Ownable {

    // ── Storage ──────────────────────────────────────────────────
    mapping(address => uint256) private _reputation;
    mapping(address => bool)    private _registered;
    address[] private _agents;

    uint256 public constant LOW_REPUTATION_THRESHOLD = 50;

    // ── Events ───────────────────────────────────────────────────
    event AgentRegistered(address indexed agent, uint256 initialReputation);
    event ReputationUpdated(address indexed agent, uint256 oldScore, uint256 newScore);

    // ── Constructor ──────────────────────────────────────────────
    constructor() Ownable(msg.sender) {}

    // ── Write ────────────────────────────────────────────────────

    /**
     * @notice Register an agent with an initial reputation score.
     * @param agent           The agent's wallet address
     * @param initialScore    0-100; 0 = untrusted, 100 = fully trusted
     */
    function registerAgent(address agent, uint256 initialScore) external onlyOwner {
        require(!_registered[agent], "Already registered");
        require(initialScore <= 100, "Score must be 0-100");
        _registered[agent] = true;
        _reputation[agent] = initialScore;
        _agents.push(agent);
        emit AgentRegistered(agent, initialScore);
    }

    /**
     * @notice Update the reputation score for an already-registered agent.
     */
    function setReputation(address agent, uint256 newScore) external onlyOwner {
        require(_registered[agent], "Not registered");
        require(newScore <= 100, "Score must be 0-100");
        uint256 old = _reputation[agent];
        _reputation[agent] = newScore;
        emit ReputationUpdated(agent, old, newScore);
    }

    // ── Read ─────────────────────────────────────────────────────

    /**
     * @notice Returns the reputation score for an agent.
     *         Returns 0 for unregistered agents (treat as untrusted).
     */
    function getReputation(address agent) external view returns (uint256) {
        return _reputation[agent];
    }

    /**
     * @notice Returns true if the agent has registered an on-chain identity.
     */
    function isRegistered(address agent) external view returns (bool) {
        return _registered[agent];
    }

    /**
     * @notice Returns true if the agent is registered AND has reputation >= threshold.
     */
    function isTrusted(address agent) external view returns (bool) {
        return _registered[agent] && _reputation[agent] >= LOW_REPUTATION_THRESHOLD;
    }

    /**
     * @notice Total number of registered agents.
     */
    function totalAgents() external view returns (uint256) {
        return _agents.length;
    }
}
