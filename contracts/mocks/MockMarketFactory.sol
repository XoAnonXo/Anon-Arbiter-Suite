// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title MockMarketFactory
/// @notice Mock factory for testing DisputeResolver
contract MockMarketFactory {
    mapping(address oracle => address market) public markets;
    address public owner;

    event MarketSet(address indexed oracle, address indexed market);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Set market for an oracle
    /// @param oracle Oracle address
    /// @param market Market address
    function setMarket(address oracle, address market) external onlyOwner {
        markets[oracle] = market;
        emit MarketSet(oracle, market);
    }

    /// @notice Get market by oracle (required by DisputeResolver)
    /// @param oracle Oracle address
    /// @return market Market address
    function getMarketByPoll(address oracle) external view returns (address) {
        return markets[oracle];
    }
}
