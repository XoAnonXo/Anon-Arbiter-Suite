// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title MockMarketFactory
/// @notice Mock factory for testing DisputeResolver - supports both AMM and PariMutuel markets
contract MockMarketFactory {
    mapping(address oracle => address market) public ammMarkets;
    mapping(address oracle => address market) public pariMutuelMarkets;
    address public owner;

    event AMMMarketSet(address indexed oracle, address indexed market);
    event PariMutuelMarketSet(address indexed oracle, address indexed market);

    constructor() {
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Set AMM market for an oracle
    /// @param oracle Oracle address
    /// @param market Market address
    function setAMMMarket(address oracle, address market) external onlyOwner {
        ammMarkets[oracle] = market;
        emit AMMMarketSet(oracle, market);
    }

    /// @notice Set PariMutuel market for an oracle
    /// @param oracle Oracle address
    /// @param market Market address
    function setPariMutuelMarket(address oracle, address market) external onlyOwner {
        pariMutuelMarkets[oracle] = market;
        emit PariMutuelMarketSet(oracle, market);
    }

    /// @notice Get AMM market by oracle (required by DisputeResolver)
    /// @param oracle Oracle address
    /// @return market Market address
    function getMarketByPoll(address oracle) external view returns (address) {
        return ammMarkets[oracle];
    }

    /// @notice Get PariMutuel market by oracle (required by DisputeResolver)
    /// @param oracle Oracle address
    /// @return market Market address
    function getPariMutuelByPoll(address oracle) external view returns (address) {
        return pariMutuelMarkets[oracle];
    }
}
