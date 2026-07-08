// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract MockOracle {
    int256 private _value;

    constructor(int256 initialValue) {
        _value = initialValue;
    }

    function setValue(int256 value) external {
        _value = value;
    }

    function latestRoundData() external view returns (
        uint80 roundId,
        int256 answer,
        uint256 startedAt,
        uint256 updatedAt,
        uint80 answeredInRound
    ) {
        return (1, _value, block.timestamp, block.timestamp, 1);
    }
}
