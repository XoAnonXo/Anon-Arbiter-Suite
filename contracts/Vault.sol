// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { TransferHelper } from "./libraries/TransferHelper.sol";

contract Vault is Ownable {
    using TransferHelper for address;

    /// @notice Mapping of approved dispute resolvers
    mapping(address => bool) public approvedResolvers;

    event ResolverApproved(address indexed resolver, bool approved);
    event DisputeToppedUp(address indexed resolver, address token, uint256 amount);

    constructor(address _multisig) Ownable(_multisig) {}

    /// @notice Allow contract to receive ETH
    receive() external payable {}

    /// @notice Approve or revoke dispute resolver
    /// @param _resolver Address of dispute resolver contract
    /// @param _approved True to approve, false to revoke
    function setApprovedResolver(address _resolver, bool _approved) external onlyOwner {
        approvedResolvers[_resolver] = _approved;
        emit ResolverApproved(_resolver, _approved);
    }

    /// @notice Top up dispute with tokens from vault
    /// @dev Only callable by approved dispute resolvers
    /// @param _token Token address to transfer
    /// @param _amount Amount of tokens to transfer
    function topUpDispute(address _token, uint256 _amount) external {
        require(approvedResolvers[msg.sender], "Not approved resolver");
        _token.safeTransfer(msg.sender, _amount);
        emit DisputeToppedUp(msg.sender, _token, _amount);
    }

    function withdraw(address _token) external onlyOwner {
        if (_token == address(0)) {
            uint256 amount = address(this).balance;
            (bool success, ) = msg.sender.call{ value: amount }("");
            require(success);
        } else {
            (, bytes memory resp) = address(_token).staticcall(
                abi.encodeWithSignature("balanceOf(address)", address(this))
            );
            uint amount = abi.decode(resp, (uint));
            _token.safeTransfer(msg.sender, amount);
        }
    }
}
