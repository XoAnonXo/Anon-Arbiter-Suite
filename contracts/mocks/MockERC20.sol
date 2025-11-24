// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockERC20
/// @notice Mock ERC20 token for testing
contract MockERC20 is ERC20, Ownable {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 decimals_) ERC20(name, symbol) Ownable(msg.sender) {
        _decimals = decimals_;
    }

    /// @notice Mint tokens
    /// @param to Recipient address
    /// @param amount Amount to mint
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Burn tokens
    /// @param from Address to burn from
    /// @param amount Amount to burn
    function burn(address from, uint256 amount) external onlyOwner {
        _burn(from, amount);
    }

    /// @notice Get decimals
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    /// @notice Mint to msg.sender for testing
    /// @param amount Amount to mint
    function mintToSelf(uint256 amount) external {
        _mint(msg.sender, amount);
    }
}
