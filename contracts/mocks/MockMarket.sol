// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title MockMarket
/// @notice Mock market for testing DisputeResolver
contract MockMarket {
    address public owner;
    address public collateralToken;

    // Reserves data
    uint112 public reserve0;
    uint112 public reserve1;
    uint256 public reserve2;
    uint256 public reserve3;
    uint256 public collateralTvl;

    event CollateralTokenSet(address indexed token);
    event ReservesSet(uint112 r0, uint112 r1, uint256 r2, uint256 r3, uint256 tvl);

    constructor(address _collateralToken) {
        owner = msg.sender;
        collateralToken = _collateralToken;

        // Set default reserves
        reserve0 = 1000000;
        reserve1 = 1000000;
        reserve2 = 0;
        reserve3 = 0;
        collateralTvl = 10_000_000 * 1e18; // 10M tokens TVL
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

    /// @notice Set reserves data
    /// @param _r0 Reserve 0
    /// @param _r1 Reserve 1
    /// @param _r2 Reserve 2
    /// @param _r3 Reserve 3
    /// @param _tvl Collateral TVL
    function setReserves(uint112 _r0, uint112 _r1, uint256 _r2, uint256 _r3, uint256 _tvl) external onlyOwner {
        reserve0 = _r0;
        reserve1 = _r1;
        reserve2 = _r2;
        reserve3 = _r3;
        collateralTvl = _tvl;
        emit ReservesSet(_r0, _r1, _r2, _r3, _tvl);
    }

    /// @notice Get reserves (required by DisputeResolver)
    /// @return _r0 Reserve 0
    /// @return _r1 Reserve 1
    /// @return _r2 Reserve 2
    /// @return _r3 Reserve 3
    /// @return _tvl Collateral TVL
    function getReserves() external view returns (uint112 _r0, uint112 _r1, uint256 _r2, uint256 _r3, uint256 _tvl) {
        return (reserve0, reserve1, reserve2, reserve3, collateralTvl);
    }
}
