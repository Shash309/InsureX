// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface AggregatorV3Interface {
    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    );
}

import "./PolicyNFT.sol";

/**
 * @title AutoClaim
 * @dev Parametric insurance trigger contract.
 *      Reads real-world data from Chainlink oracles and
 *      auto-executes claims on PolicyNFT when conditions are met.
 *
 *      Supported trigger types:
 *      - FLIGHT_DELAY   : flight delayed beyond threshold (minutes)
 *      - RAINFALL       : rainfall below threshold (mm)
 *      - TEMPERATURE    : temperature beyond threshold (celsius * 100)
 *      - CUSTOM         : any numeric oracle feed
 */
contract AutoClaim {

    // ─── Enums & Structs ─────────────────────────────────────────────────────

    enum TriggerType { FLIGHT_DELAY, RAINFALL, TEMPERATURE, CUSTOM }
    enum Operator    { LESS_THAN, GREATER_THAN, EQUAL_TO }

    struct TriggerCondition {
        uint256      policyTokenId;
        TriggerType  triggerType;
        address      oracleFeed;        // Chainlink price feed address
        int256       threshold;         // value to compare against
        Operator     operator;
        bool         triggered;
        uint256      registeredAt;
    }

    // ─── State ───────────────────────────────────────────────────────────────

    PolicyNFT public policyNFT;
    address   public owner;

    mapping(uint256 => TriggerCondition) public triggers;  // policyTokenId => condition
    uint256[] public registeredPolicies;

    // ─── Events ──────────────────────────────────────────────────────────────

    event TriggerRegistered(
        uint256 indexed policyTokenId,
        TriggerType triggerType,
        int256 threshold
    );

    event TriggerFired(
        uint256 indexed policyTokenId,
        int256 oracleValue,
        int256 threshold
    );

    event TriggerCheckFailed(
        uint256 indexed policyTokenId,
        string reason
    );

    // ─── Constructor ─────────────────────────────────────────────────────────

    constructor(address _policyNFT) {
        policyNFT = PolicyNFT(payable(_policyNFT));
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "AutoClaim: not owner");
        _;
    }

    // ─── Register a Trigger ──────────────────────────────────────────────────

    /**
     * @notice Register an oracle-based auto-claim trigger for a policy
     * @param _policyTokenId  NFT token ID of the policy
     * @param _triggerType    Type of parametric trigger
     * @param _oracleFeed     Chainlink data feed address for this trigger
     * @param _threshold      Value boundary that activates the claim
     * @param _operator       LESS_THAN / GREATER_THAN / EQUAL_TO
     *
     * Example: crop insurance that pays when rainfall < 50mm
     *   registerTrigger(42, RAINFALL, 0xRainfallFeed, 50, LESS_THAN)
     */
    function registerTrigger(
        uint256     _policyTokenId,
        TriggerType _triggerType,
        address     _oracleFeed,
        int256      _threshold,
        Operator    _operator
    ) external {
        require(
            policyNFT.ownerOf(_policyTokenId) == msg.sender,
            "AutoClaim: not policyholder"
        );
        require(
            !triggers[_policyTokenId].triggered,
            "AutoClaim: trigger already fired"
        );

        triggers[_policyTokenId] = TriggerCondition({
            policyTokenId: _policyTokenId,
            triggerType:   _triggerType,
            oracleFeed:    _oracleFeed,
            threshold:     _threshold,
            operator:      _operator,
            triggered:     false,
            registeredAt:  block.timestamp
        });

        registeredPolicies.push(_policyTokenId);

        emit TriggerRegistered(_policyTokenId, _triggerType, _threshold);
    }

    // ─── Check & Execute Trigger ─────────────────────────────────────────────

    /**
     * @notice Check oracle data and execute claim if condition is met
     * @dev Can be called by Chainlink Automation (Keepers) on a schedule
     */
    function checkAndExecute(uint256 _policyTokenId) external {
        TriggerCondition storage trigger = triggers[_policyTokenId];

        require(trigger.oracleFeed != address(0), "AutoClaim: no trigger registered");
        require(!trigger.triggered, "AutoClaim: already triggered");

        int256 oracleValue = _getLatestValue(trigger.oracleFeed);
        bool conditionMet  = _evaluateCondition(oracleValue, trigger.threshold, trigger.operator);

        if (conditionMet) {
            trigger.triggered = true;

            emit TriggerFired(_policyTokenId, oracleValue, trigger.threshold);

            // Call auto-approve on the PolicyNFT contract
            try policyNFT.autoApproveClaim(_policyTokenId) {
                // Payout succeeded
            } catch Error(string memory reason) {
                trigger.triggered = false; // reset so it can retry
                emit TriggerCheckFailed(_policyTokenId, reason);
            }
        }
    }

    /**
     * @notice Batch check all registered policies (for Chainlink Keepers)
     */
    function batchCheck() external {
        for (uint256 i = 0; i < registeredPolicies.length; i++) {
            uint256 tokenId = registeredPolicies[i];
            if (!triggers[tokenId].triggered) {
                this.checkAndExecute(tokenId);
            }
        }
    }

    // ─── Internal Helpers ────────────────────────────────────────────────────

    function _getLatestValue(address feedAddress) internal view returns (int256) {
        AggregatorV3Interface feed = AggregatorV3Interface(feedAddress);
        (, int256 value, , , ) = feed.latestRoundData();
        return value;
    }

    function _evaluateCondition(
        int256   oracleValue,
        int256   threshold,
        Operator operator
    ) internal pure returns (bool) {
        if (operator == Operator.LESS_THAN)    return oracleValue < threshold;
        if (operator == Operator.GREATER_THAN) return oracleValue > threshold;
        if (operator == Operator.EQUAL_TO)     return oracleValue == threshold;
        return false;
    }

    // ─── View ────────────────────────────────────────────────────────────────

    function getTrigger(uint256 tokenId) external view returns (TriggerCondition memory) {
        return triggers[tokenId];
    }

    function getRegisteredCount() external view returns (uint256) {
        return registeredPolicies.length;
    }

    function getLiveOracleValue(address feedAddress) external view returns (int256) {
        return _getLatestValue(feedAddress);
    }
}
