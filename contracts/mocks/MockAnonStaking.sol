// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockAnonStaking
/// @notice Mock xAnonStakingNFT for testing DisputeResolverHome
contract MockAnonStaking is ERC721Enumerable, Ownable {
    struct PositionData {
        uint96 amount;
        uint8 poolId;
        uint64 lockedUntil;
        uint64 lastPaidDay;
    }

    mapping(uint256 tokenId => PositionData) public positions;
    mapping(uint256 tokenId => uint256) public pendingRewards;

    error ZeroAddress();
    error TokenDoesNotExist();
    error NotAuthorized();

    event PositionSet(uint256 indexed tokenId, PositionData position);
    event RewardSet(uint256 indexed tokenId, uint256 reward);
    event RewardClaimed(address indexed to, uint256 indexed tokenId, uint256 reward);

    constructor() ERC721("xAnon Staking NFT", "xAnonS") Ownable(msg.sender) {}

    /// @notice Mint NFT to user
    /// @param to Recipient address
    /// @param tokenId Token ID to mint
    function mint(address to, uint256 tokenId) external onlyOwner {
        _safeMint(to, tokenId);
    }

    /// @notice Set position data for a tokenId
    /// @param tokenId Token ID
    /// @param amount Staked amount
    /// @param poolId Pool ID (0/1/2)
    /// @param lockedUntil Lock timestamp
    /// @param lastPaidDay Last paid day
    function setPosition(
        uint256 tokenId,
        uint96 amount,
        uint8 poolId,
        uint64 lockedUntil,
        uint64 lastPaidDay
    ) external onlyOwner {
        positions[tokenId] = PositionData({
            amount: amount,
            poolId: poolId,
            lockedUntil: lockedUntil,
            lastPaidDay: lastPaidDay
        });
        emit PositionSet(tokenId, positions[tokenId]);
    }

    /// @notice Set pending rewards for a tokenId
    /// @param tokenId Token ID
    /// @param reward Pending reward amount
    function setReward(uint256 tokenId, uint256 reward) external onlyOwner {
        pendingRewards[tokenId] = reward;
        emit RewardSet(tokenId, reward);
    }

    /// @notice Get position data (matches xAnonStakingNFT interface)
    /// @param tokenId Token ID
    /// @return position Position data
    /// @return pending Pending rewards
    function positionOf(uint256 tokenId) external view returns (PositionData memory position, uint256 pending) {
        return (positions[tokenId], pendingRewards[tokenId]);
    }

    /// @notice Claim rewards (matches xAnonStakingNFT interface)
    /// @param to Recipient address
    /// @param tokenId Token ID
    /// @return reward Reward amount claimed
    function earnReward(address to, uint256 tokenId) external returns (uint256 reward) {
        _validateTokenOwnership(to, tokenId);
        reward = pendingRewards[tokenId];
        pendingRewards[tokenId] = 0;
        emit RewardClaimed(to, tokenId, reward);
        return reward;
    }

    /// @notice Batch mint for testing
    /// @param to Recipient address
    /// @param tokenIds Array of token IDs
    /// @param amount Staked amount for all
    /// @param poolId Pool ID for all
    /// @param lockDays Days to lock
    function batchMintWithData(
        address to,
        uint256[] calldata tokenIds,
        uint96 amount,
        uint8 poolId,
        uint64 lockDays
    ) external onlyOwner {
        uint64 lockedUntil = uint64(block.timestamp + (lockDays * 1 days));
        uint64 lastPaidDay = uint64(block.timestamp / 1 days);

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            _safeMint(to, tokenId);
            positions[tokenId] = PositionData({
                amount: amount,
                poolId: poolId,
                lockedUntil: lockedUntil,
                lastPaidDay: lastPaidDay
            });
        }
    }

    /// @notice Validate token ownership and authorization
    /// @param to Recipient address
    /// @param tokenId Token ID
    /// @return owner Token owner address
    function _validateTokenOwnership(address to, uint256 tokenId) private view returns (address owner) {
        if (to == address(0)) revert ZeroAddress();
        owner = _ownerOf(tokenId);
        if (owner == address(0)) revert TokenDoesNotExist();
        if (!_isAuthorized(owner, msg.sender, tokenId)) revert NotAuthorized();
    }
}
