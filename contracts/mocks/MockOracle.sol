// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title MockOracle
/// @notice Mock oracle for testing DisputeResolver
contract MockOracle {
    address public owner;

    enum PollStatus {
        Pending,
        Yes,
        No,
        Unknown
    }

    // Configurable state
    uint32 public ARBITRATION_ESCALATION_PERIOD = 432; // epochs (432 * 5 minutes = 36 hours, matches PredictionPoll)
    bool public arbitrationStarted; // Public in real contract

    // Private state (only exposed via getters, matches real PredictionPoll)
    bool private isFinalized;
    PollStatus private status;
    string private resolutionReason;

    event ArbitrationStarted();
    event ArbitrationResolved(PollStatus status, string reason);
    event EscalationPeriodUpdated(uint32 newPeriod);
    event StatusUpdated(bool isFinalized, PollStatus status);

    constructor() {
        owner = msg.sender;
        status = PollStatus.Yes; // Default draft status
        isFinalized = false;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Set escalation period (epochs)
    /// @param _period New escalation period in epochs
    function setEscalationPeriod(uint32 _period) external onlyOwner {
        ARBITRATION_ESCALATION_PERIOD = _period;
        emit EscalationPeriodUpdated(_period);
    }

    /// @notice Set finalized status
    /// @param _isFinalized Is finalized
    /// @param _status Current status
    function setStatus(bool _isFinalized, PollStatus _status) external onlyOwner {
        isFinalized = _isFinalized;
        status = _status;
        emit StatusUpdated(_isFinalized, _status);
    }

    /// @notice Get current status (matches PredictionPoll interface)
    /// @return Current status
    function getStatus() external view returns (PollStatus) {
        return status;
    }

    /// @notice Get finalized status (required by DisputeResolver, matches PredictionPoll interface)
    /// @return _isFinalized Is finalized
    /// @return _status Current status
    function getFinalizedStatus() external view returns (bool _isFinalized, PollStatus _status) {
        return (isFinalized, status);
    }

    /// @notice Start arbitration (called by DisputeResolver)
    function startArbitration() external {
        arbitrationStarted = true;
        emit ArbitrationStarted();
    }

    /// @notice Resolve arbitration (called by DisputeResolver)
    /// @param _status Final status
    /// @param _reason Reason for resolution
    function resolveArbitration(uint8 _status, string calldata _reason) external {
        status = PollStatus(_status);
        resolutionReason = _reason;
        isFinalized = true;
        emit ArbitrationResolved(PollStatus(_status), _reason);
    }

    /// @notice Reset for new test
    function reset() external onlyOwner {
        arbitrationStarted = false;
        resolutionReason = "";
        isFinalized = false;
        status = PollStatus.Yes;
    }
}
