// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SimulationRegistry
 * @notice On-chain registry for ArbiSim Guard pre-flight simulation results.
 * @dev Chain-agnostic. Deployed on Arbitrum One and Avalanche C-Chain mainnet.
 * @custom:version 2
 */
contract SimulationRegistry {

    // ── Version ────────────────────────────────────────────────────────────
    uint8 public constant VERSION = 2;

    // ── Roles ──────────────────────────────────────────────────────────────
    address public owner;
    mapping(address => bool) public reporters;

    // ── Flags (uint16, chain-agnostic) ─────────────────────────────────────
    uint16 public constant FLAG_REVERT                 = 1 << 0;
    uint16 public constant FLAG_HIGH_SLIPPAGE          = 1 << 1;
    uint16 public constant FLAG_MEV_RISK               = 1 << 2;
    uint16 public constant FLAG_GAS_ESTIMATE_HIGH      = 1 << 3;
    uint16 public constant FLAG_LOW_REPUTATION         = 1 << 4;
    uint16 public constant FLAG_UNKNOWN_AGENT          = 1 << 5;
    uint16 public constant FLAG_PRICE_IMPACT_HIGH      = 1 << 6;
    uint16 public constant FLAG_INSUFFICIENT_LIQUIDITY = 1 << 7;
    uint16 public constant FLAG_BRIDGE_RISK            = 1 << 8;
    uint16 public constant FLAG_ORACLE_MANIPULATION    = 1 << 9;
    uint16 public constant FLAG_VALUE_TRANSFER         = 1 << 10;
    uint16 public constant FLAG_CONTRACT_CREATION      = 1 << 11;
    // bits 12-15 reserved for future flags

    // ── Constants ──────────────────────────────────────────────────────────
    uint256 public constant MAX_REVERT_REASON_LENGTH = 256;

    // ── Storage ────────────────────────────────────────────────────────────
    struct SimulationRecord {
        address agent;
        bytes32 txHash;
        bool safeToExecute;
        uint16 flagsBitmap;
        uint64 gasEstimate;
        uint32 chainId;
        uint32 timestamp;
    }

    mapping(bytes32 => SimulationRecord) public records;
    mapping(bytes32 => string) public revertReasons;
    mapping(address => bytes32[]) private agentSessions;
    uint256 public totalSimulations;

    // ── Events ─────────────────────────────────────────────────────────────
    event SimulationLogged(
        bytes32 indexed sessionId,
        address indexed agent,
        bool safeToExecute,
        uint16 flagsBitmap,
        uint32 chainId
    );
    event ReporterAdded(address indexed reporter);
    event ReporterRemoved(address indexed reporter);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    // ── Errors ─────────────────────────────────────────────────────────────
    error Unauthorized();
    error SessionExists(bytes32 sessionId);
    error RevertReasonTooLong(uint256 length, uint256 max);
    error ZeroAddress();

    // ── Modifiers ──────────────────────────────────────────────────────────
    modifier onlyOwner() {
        _onlyOwner();
        _;
    }

    modifier onlyReporter() {
        _onlyReporter();
        _;
    }

    function _onlyOwner() internal view {
        if (msg.sender != owner) revert Unauthorized();
    }

    function _onlyReporter() internal view {
        if (!reporters[msg.sender] && msg.sender != owner) revert Unauthorized();
    }

    // ── Constructor ────────────────────────────────────────────────────────
    constructor() {
        owner = msg.sender;
        reporters[msg.sender] = true;
        emit ReporterAdded(msg.sender);
    }

    // ── Reporter management ────────────────────────────────────────────────
    function addReporter(address reporter) external onlyOwner {
        reporters[reporter] = true;
        emit ReporterAdded(reporter);
    }

    function removeReporter(address reporter) external onlyOwner {
        reporters[reporter] = false;
        emit ReporterRemoved(reporter);
    }

    // ── Core: log simulation ───────────────────────────────────────────────
    function logSimulation(
        bytes32 sessionId,
        address agent,
        bytes32 txHash,
        bool safeToExecute,
        uint16 flagsBitmap,
        uint64 gasEstimate,
        string calldata revertReason,
        uint32 chainId
    ) external onlyReporter {
        if (records[sessionId].timestamp != 0) revert SessionExists(sessionId);
        if (bytes(revertReason).length > MAX_REVERT_REASON_LENGTH)
            revert RevertReasonTooLong(bytes(revertReason).length, MAX_REVERT_REASON_LENGTH);

        records[sessionId] = SimulationRecord({
            agent:         agent,
            txHash:        txHash,
            safeToExecute: safeToExecute,
            flagsBitmap:   flagsBitmap,
            gasEstimate:   gasEstimate,
            chainId:       chainId,
            timestamp:     uint32(block.timestamp)
        });

        if (bytes(revertReason).length > 0) {
            revertReasons[sessionId] = revertReason;
        }

        agentSessions[agent].push(sessionId);
        totalSimulations++;

        emit SimulationLogged(sessionId, agent, safeToExecute, flagsBitmap, chainId);
    }

    // ── Read: paginated sessions ───────────────────────────────────────────
    function getSessionIds(
        address agent,
        uint256 offset,
        uint256 limit
    ) external view returns (bytes32[] memory page, uint256 total) {
        bytes32[] storage all = agentSessions[agent];
        total = all.length;

        if (offset >= total || limit == 0) return (new bytes32[](0), total);

        uint256 end = offset + limit > total ? total : offset + limit;
        page = new bytes32[](end - offset);
        for (uint256 i = 0; i < page.length; i++) {
            page[i] = all[offset + i];
        }
    }

    // ── Read: full record ──────────────────────────────────────────────────
    function getRecord(bytes32 sessionId) external view returns (
        SimulationRecord memory record,
        string memory revertReason
    ) {
        return (records[sessionId], revertReasons[sessionId]);
    }

    // ── Ownership ──────────────────────────────────────────────────────────
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
