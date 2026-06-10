// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SimulationRegistry
 * @author ArbiSim Guard
 * @notice Immutable on-chain audit trail of pre-flight simulation verdicts.
 *         Each record maps a session ID to its outcome (APPROVED/REJECTED),
 *         gas cost, safety flags, and block timestamp.
 *         Deployed on Arbitrum Sepolia for the Open House London Buildathon.
 *
 * @dev Only the ArbiSim Guard backend (owner) can log simulation results.
 *      Records are write-once: a session ID cannot be overwritten.
 *      Supports both single and batch logging for gas efficiency.
 */
contract SimulationRegistry is Ownable, Pausable, ReentrancyGuard {

    // ── Structs ─────────────────────────────────────────────────

    struct SimulationRecord {
        bytes32 sessionId;
        bool    passed;           // true = APPROVED, false = REJECTED
        uint256 gasCostWei;       // Total L2 + L1 gas cost in wei
        string  revertReason;     // Empty if passed; error string if rejected
        uint8   flagsBitmap;      // Packed safety flags (see FLAG_* constants)
        uint256 timestamp;        // block.timestamp when logged
        address reporter;         // msg.sender (always owner)
    }

    // ── Safety flag bit positions ────────────────────────────────
    // Pack up to 8 boolean flags into a single uint8 for gas savings.

    uint8 public constant FLAG_EXECUTION_REVERTED   = 1 << 0; // 0x01
    uint8 public constant FLAG_HIGH_SLIPPAGE        = 1 << 1; // 0x02
    uint8 public constant FLAG_SANDWICH_DETECTED    = 1 << 2; // 0x04
    uint8 public constant FLAG_UNSAFE_ALLOWANCE     = 1 << 3; // 0x08
    uint8 public constant FLAG_SIG_FAILED           = 1 << 4; // 0x10
    uint8 public constant FLAG_VALID_UNTIL_EXPIRED  = 1 << 5; // 0x20
    uint8 public constant FLAG_TIMEBOOST_RECOMMENDED = 1 << 6; // 0x40
    uint8 public constant FLAG_STYLUS_INK_OVERFLOW  = 1 << 7; // 0x80

    // ── Storage ─────────────────────────────────────────────────

    mapping(bytes32 => SimulationRecord) public records;
    bytes32[] public sessionIds;

    // ── Events ──────────────────────────────────────────────────

    event SimulationLogged(
        bytes32 indexed sessionId,
        bool    passed,
        uint256 gasCostWei,
        string  revertReason,
        uint8   flagsBitmap,
        uint256 timestamp
    );

    event BatchLogged(uint256 count);

    // ── Constructor ─────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ── Write functions ─────────────────────────────────────────

    /**
     * @notice Log a single simulation verdict on-chain.
     * @param sessionId    UUID of the simulation session (as bytes32)
     * @param passed       true = APPROVED, false = REJECTED
     * @param gasCostWei   Total L2 + L1 gas cost in wei
     * @param revertReason Empty string if passed; error message if rejected
     * @param flagsBitmap  Packed safety flags (OR the FLAG_* constants)
     */
    function logSimulation(
        bytes32 sessionId,
        bool    passed,
        uint256 gasCostWei,
        string calldata revertReason,
        uint8   flagsBitmap
    ) external onlyOwner whenNotPaused {
        require(records[sessionId].timestamp == 0, "Already logged");

        records[sessionId] = SimulationRecord({
            sessionId:    sessionId,
            passed:       passed,
            gasCostWei:   gasCostWei,
            revertReason: revertReason,
            flagsBitmap:  flagsBitmap,
            timestamp:    block.timestamp,
            reporter:     msg.sender
        });

        sessionIds.push(sessionId);

        emit SimulationLogged(
            sessionId, passed, gasCostWei, revertReason, flagsBitmap, block.timestamp
        );
    }

    /**
     * @notice Log multiple simulation verdicts in a single transaction.
     *         Saves gas when the backend has a batch of completed simulations.
     * @param _sessionIds    Array of session IDs
     * @param _passed        Array of verdicts
     * @param _gasCostWeis   Array of gas costs in wei
     * @param _revertReasons Array of revert reasons
     * @param _flagsBitmaps  Array of packed safety flags
     */
    function logSimulationBatch(
        bytes32[] calldata _sessionIds,
        bool[]    calldata _passed,
        uint256[] calldata _gasCostWeis,
        string[]  calldata _revertReasons,
        uint8[]   calldata _flagsBitmaps
    ) external onlyOwner whenNotPaused nonReentrant {
        uint256 len = _sessionIds.length;
        require(
            len == _passed.length &&
            len == _gasCostWeis.length &&
            len == _revertReasons.length &&
            len == _flagsBitmaps.length,
            "Array length mismatch"
        );
        require(len <= 50, "Batch too large");

        for (uint256 i = 0; i < len; i++) {
            bytes32 sid = _sessionIds[i];
            require(records[sid].timestamp == 0, "Already logged");

            records[sid] = SimulationRecord({
                sessionId:    sid,
                passed:       _passed[i],
                gasCostWei:   _gasCostWeis[i],
                revertReason: _revertReasons[i],
                flagsBitmap:  _flagsBitmaps[i],
                timestamp:    block.timestamp,
                reporter:     msg.sender
            });

            sessionIds.push(sid);

            emit SimulationLogged(
                sid, _passed[i], _gasCostWeis[i], _revertReasons[i],
                _flagsBitmaps[i], block.timestamp
            );
        }

        emit BatchLogged(len);
    }

    // ── Read functions ──────────────────────────────────────────

    /**
     * @notice Retrieve a simulation record by session ID.
     */
    function getRecord(bytes32 sessionId)
        external view returns (SimulationRecord memory)
    {
        return records[sessionId];
    }

    /**
     * @notice Total number of simulations logged on-chain.
     */
    function totalSimulations() external view returns (uint256) {
        return sessionIds.length;
    }

    /**
     * @notice Check if a specific safety flag is set in a record.
     * @param sessionId The session to check
     * @param flag      One of the FLAG_* constants
     */
    function hasFlag(bytes32 sessionId, uint8 flag)
        external view returns (bool)
    {
        return (records[sessionId].flagsBitmap & flag) != 0;
    }

    // ── Admin functions ─────────────────────────────────────────

    /**
     * @notice Pause the registry. Prevents new records from being logged.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause the registry.
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
