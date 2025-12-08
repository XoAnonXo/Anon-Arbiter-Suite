// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title MockMarket
/// @notice Mock market for testing DisputeResolver - supports both AMM and PariMutuel interfaces
contract MockMarket {
    address public owner;
    address public collateralToken;
    uint256 public collateralTvl;
    bool public isLive;
    uint24 public yesChance;

    event CollateralTokenSet(address indexed token);
    event TVLSet(uint256 tvl);
    event IsLiveSet(bool isLive);
    event YesChanceSet(uint24 yesChance);

    constructor(address _collateralToken) {
        owner = msg.sender;
        collateralToken = _collateralToken;
        collateralTvl = 10_000_000 * 1e18; // 10M tokens TVL
        isLive = true; // Market is live by default
        yesChance = 500000; // 50% chance by default
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Set collateral token
    /// @param _token Collateral token address
    function setCollateralToken(address _token) external onlyOwner {
        collateralToken = _token;
        emit CollateralTokenSet(_token);
    }

    /// @notice Set TVL
    /// @param _tvl Collateral TVL
    function setTVL(uint256 _tvl) external onlyOwner {
        collateralTvl = _tvl;
        emit TVLSet(_tvl);
    }

    /// @notice Set market live status
    /// @param _isLive Whether market is live
    function setIsLive(bool _isLive) external onlyOwner {
        isLive = _isLive;
        emit IsLiveSet(_isLive);
    }

    /// @notice Set YES chance
    /// @param _yesChance YES chance (0-1000000, where 1000000 = 100%)
    function setYesChance(uint24 _yesChance) external onlyOwner {
        require(_yesChance <= 1000000, "Invalid yes chance");
        yesChance = _yesChance;
        emit YesChanceSet(_yesChance);
    }

    /// @notice Get market state (required by DisputeResolver - universal method for AMM & PariMutuel)
    /// @return isLive_ Market is live
    /// @return collateralTvl_ Total value locked in collateral
    /// @return yesChance_ YES chance
    /// @return collateral Collateral token address
    function marketState()
        external
        view
        returns (bool isLive_, uint256 collateralTvl_, uint24 yesChance_, address collateral)
    {
        return (isLive, collateralTvl, yesChance, collateralToken);
    }
}
