// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ERC721Enumerable } from "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { IERC721Receiver } from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import { TransferHelper } from "./libraries/TransferHelper.sol";
import { Errors } from "./libraries/Errors.sol";

/// @title DisputeResolverHome - Home Chain Dispute Resolution
/// @notice Full dispute resolution with ERC721 wrapping and cross-chain voting
/// @dev Deployed only on home chain where AnonStaking NFTs exist
///
/// Architecture:
/// 1. Home Chain: Wraps AnonStaking NFTs, has dispute logic for HOME markets/oracles
/// 2. Users vote locally on home chain disputes
/// 3. Users vote on remote chain disputes by calling voteOnRemoteDispute() - sends message to remote
/// 4. Remote chains have their own dispute logic for THEIR markets/oracles
contract DisputeResolverHome is ERC721Enumerable, OApp, OAppOptionsType3 {
    using TransferHelper for address;

    IERC721 public immutable AnonStaking;
    address public immutable marketFactory;
    address public immutable vault;
    // Our system supports only one-year NFT staking
    uint private constant ANON_STAKE_POOL_INDEX = 2;
    uint private constant EPOCH_LENGTH = 5 minutes;
    uint private constant TIME_FOR_APPLY = 2 hours;
    uint public constant BPS = 10_000;
    uint public constant PROTOCOL_FEE = 2_000;
    uint public constant MINIMUM_COLLATERAL = 1e6;
    uint private constant COLLATERAL_DIVISOR = 100;
    uint public constant MAX_REASON_LENGTH = 200;

    enum DisputeState {
        NotActive,
        Active,
        Resolved,
        Failed
    }

    enum VoteOption {
        Pending,
        Yes,
        No,
        Unknown
    }

    struct PositionData {
        uint96 amount;
        uint8 poolId;
        uint64 lockedUntil;
        uint64 lastPaidDay;
    }

    struct NFT {
        uint96 power;
        uint48 voteDisabledUntil;
        uint48 unstakeAvailableAt;
        uint48 validTo;
    }

    mapping(uint tokenId => NFT) public nftInfos;

    struct VoteRecord {
        bool isClaimed;
        VoteOption votedFor;
    }

    struct Dispute {
        address disputer;
        bool isCollateralTaken;
        DisputeState state;
        VoteOption draftStatus;
        VoteOption finalStatus;
        uint48 endAt;
        address marketToken;
        uint96 disputerDeposit;
        mapping(VoteOption => uint amount) votes;
        mapping(uint256 tokenId => VoteRecord) tokenVotes;
        string reason;
    }

    mapping(address oracle => Dispute) public disputes;
    mapping(address => bool) private _operatorApproved;
    mapping(uint256 tokenId => uint256 penaltyAmount) public penalties;
    mapping(uint256 tokenId => address[] oracles) private voteRewards;

    address public penaltyToken;
    uint32 public voteCooldown = 60 hours;
    uint32 public unwrapCooldown = 60 hours;
    //exactly uint16 for lz requirements
    uint16 public constant VOTE_MSG = 1; // Vote request to remote chain
    uint16 public constant CLAIM_MSG = 2; // Claim request to remote chain

    event DisputeCreated(address disputer, address oracle, VoteOption draftStatus, uint amount, address marketToken);
    event CollateralTaken(address disputer, address oracle, uint amount, address marketToken);
    event Vote(address voter, address oracle, uint power, VoteOption status);
    event ClaimStakeReward(address voter, uint tokenId, uint rewards);
    event VoteRewardClaimed(address voter, address oracle, uint tokenId, address token, uint reward);
    event DisputeResolved(address oracle, VoteOption finalStatus, address resolver);
    event DisputeFailed(address oracle, address disputer);
    event OperatorApproved(address indexed operator, bool approved);
    event PenaltySet(uint256 indexed tokenId, uint256 amount);
    event PenaltyPaid(uint256 indexed tokenId, address payer, uint256 amount);
    event PenaltyTokenSet(address indexed token);
    event VoteCooldownUpdated(uint32 oldCooldown, uint32 newCooldown);
    event UnwrapCooldownUpdated(uint32 oldCooldown, uint32 newCooldown);
    event RemoteVoteSent(address indexed voter, address indexed oracle, uint32 dstChainEid, uint256[] tokenIds);
    event RemoteClaimSent(address indexed claimer, address indexed oracle, uint32 dstChainEid, uint256[] tokenIds);

    constructor(
        address _layerZeroEndpoint,
        address _delegate,
        address _AnonStaking,
        address _marketFactory,
        address _vault
    ) ERC721("xAnon Voting NFT", "xAnonV") OApp(_layerZeroEndpoint, _delegate) Ownable(_delegate) {
        if (_AnonStaking == address(0)) revert Errors.InvalidAnonStakingAddress();
        AnonStaking = IERC721(_AnonStaking);
        marketFactory = _marketFactory;
        vault = _vault;
        _operatorApproved[msg.sender] = true;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // DISPUTER FUNCTIONALITY - HOME CHAIN DISPUTES
    ////////////////////////////////////////////////////////////////////////////////

    function openDispute(address _oracle, VoteOption _status, string calldata _reason) external {
        if (_status == VoteOption.Pending) revert Errors.CannotDisputeWithPendingStatus();
        if (bytes(_reason).length > MAX_REASON_LENGTH) revert Errors.ReasonTooLong();
        Dispute storage dispute = disputes[_oracle];
        if (dispute.state != DisputeState.NotActive) revert Errors.DisputeAlreadyOpened();
        if (!_canWeStartDispute(_oracle, _status)) revert Errors.MarketState();

        (uint256 amount, address marketToken) = getDisputeCollateral(_oracle);
        if (amount > type(uint96).max) revert Errors.CollateralAmountTooLarge();
        marketToken.safeTransferFrom(msg.sender, address(this), amount);
        uint timeForDispute = _getTimeFromOracle(_oracle);
        dispute.state = DisputeState.Active;
        dispute.endAt = uint48(timeForDispute - TIME_FOR_APPLY + block.timestamp);
        dispute.disputer = msg.sender;
        dispute.disputerDeposit = uint96(amount);
        dispute.draftStatus = _status;
        dispute.marketToken = marketToken;
        dispute.reason = _reason;
        _startArbitration(_oracle);
        emit DisputeCreated(msg.sender, _oracle, _status, amount, marketToken);
    }

    function takeCollateral(address _oracle) external {
        Dispute storage dispute = disputes[_oracle];
        if (dispute.disputer != msg.sender) revert Errors.NotTheDisputer();
        if (dispute.isCollateralTaken) revert Errors.AlreadyTaken();

        uint yes = dispute.votes[VoteOption.Yes];
        uint no = dispute.votes[VoteOption.No];
        uint unknown = dispute.votes[VoteOption.Unknown];
        uint totalVotes = yes + no + unknown;
        uint amount = dispute.disputerDeposit;

        if (totalVotes == 0 && dispute.endAt < block.timestamp) {
            dispute.state = DisputeState.Failed;
            emit DisputeFailed(_oracle, msg.sender);
        }

        if (
            dispute.state != DisputeState.Failed &&
            !(dispute.state == DisputeState.Resolved && dispute.finalStatus == dispute.draftStatus)
        ) revert Errors.CannotClaimCollateral();

        dispute.isCollateralTaken = true;
        dispute.marketToken.safeTransfer(msg.sender, amount);
        emit CollateralTaken(msg.sender, _oracle, amount, dispute.marketToken);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // VOTER FUNCTIONALITY - DEPOSIT/WITHDRAW
    ////////////////////////////////////////////////////////////////////////////////

    function depositFor(address account, uint256[] memory tokenIds) public virtual returns (bool) {
        uint256 length = tokenIds.length;
        if (length == 0) revert Errors.EmptyArray();
        for (uint i; i < length; ) {
            uint256 tokenId = tokenIds[i];
            PositionData memory position = _getAnonNftInfo(tokenId);
            if (position.poolId != ANON_STAKE_POOL_INDEX) revert Errors.OnlyStakeForYear();
            uint48 unlockedAt = uint48(block.timestamp + voteCooldown);
            if (position.lockedUntil <= unlockedAt) revert Errors.StaleNFT();

            AnonStaking.transferFrom(msg.sender, address(this), tokenId);
            _safeMint(account, tokenId);
            NFT storage nft = nftInfos[tokenId];
            nft.power = position.amount;
            nft.voteDisabledUntil = unlockedAt;
            nft.unstakeAvailableAt = unlockedAt;
            nft.validTo = uint48(position.lockedUntil);
            unchecked {
                ++i;
            }
        }
        return true;
    }

    function withdrawTo(address account, uint256[] memory tokenIds) public returns (bool) {
        uint256 length = tokenIds.length;
        if (length == 0) revert Errors.EmptyArray();

        for (uint i; i < length; ) {
            uint256 tokenId = tokenIds[i];
            _validateToken(tokenId);
            if (block.timestamp <= nftInfos[tokenId].unstakeAvailableAt) revert Errors.TooEarly();
            _burn(tokenId);
            unchecked {
                ++i;
            }
        }
        for (uint i; i < length; ) {
            AnonStaking.safeTransferFrom(address(this), account, tokenIds[i]);
            unchecked {
                ++i;
            }
        }
        return true;
    }

    /// @notice Vote on HOME CHAIN disputes
    function vote(address _oracle, VoteOption _status, uint256[] calldata tokenIds) external {
        Dispute storage dispute = disputes[_oracle];
        if (dispute.state != DisputeState.Active) revert Errors.DisputeNotActive();
        if (block.timestamp >= dispute.endAt) revert Errors.VotingPeriodEnded();
        if (_status == VoteOption.Pending) revert Errors.CannotVoteForPending();
        uint length = tokenIds.length;
        if (length == 0) revert Errors.EmptyTokenIdsArray();

        uint totalPower;
        uint48 disputeLockEnd = uint48(block.timestamp + unwrapCooldown);

        for (uint i; i < length; i++) {
            uint256 tokenId = tokenIds[i];

            _validateToken(tokenId);
            if (dispute.tokenVotes[tokenId].votedFor != VoteOption.Pending) continue;

            NFT storage nft = nftInfos[tokenId];
            if (nft.voteDisabledUntil >= block.timestamp) revert Errors.NFTLockedVotingCooldown();
            if (nft.validTo <= block.timestamp) revert Errors.NFTExpiredInStakingContract();

            dispute.tokenVotes[tokenId].votedFor = _status;
            totalPower += nft.power;

            if (nft.unstakeAvailableAt < disputeLockEnd) {
                nft.unstakeAvailableAt = disputeLockEnd;
            }

            // Track unclaimed vote reward
            voteRewards[tokenId].push(_oracle);
        }
        if (totalPower == 0) revert Errors.NoValidVotes();
        dispute.votes[_status] += totalPower;
        emit Vote(msg.sender, _oracle, totalPower, _status);
    }

    function claimStakeRewards(uint256[] calldata tokenIds) external returns (bool) {
        uint length = tokenIds.length;
        if (length == 0) revert Errors.EmptyTokenIdsArray();

        for (uint i; i < length; ) {
            uint256 tokenId = tokenIds[i];
            _validateToken(tokenId);
            (bool success, bytes memory response) = address(AnonStaking).call(
                abi.encodeWithSignature("earnReward(address,uint256)", msg.sender, tokenId)
            );
            if (!success) revert Errors.Fail();
            emit ClaimStakeReward(msg.sender, tokenId, (abi.decode(response, (uint256))));
            unchecked {
                ++i;
            }
        }
        return true;
    }

    /// @notice Claim rewards for HOME CHAIN disputes
    function claimVoteRewards(address _oracle, uint256[] calldata tokenIds) external returns (bool) {
        uint totalReward;
        Dispute storage dispute = disputes[_oracle];
        if (dispute.state != DisputeState.Resolved) revert Errors.DisputeNotResolved();
        uint length = tokenIds.length;
        if (length == 0) revert Errors.EmptyTokenIdsArray();

        uint totalVoted = dispute.votes[VoteOption.Yes] +
            dispute.votes[VoteOption.No] +
            dispute.votes[VoteOption.Unknown];

        for (uint i; i < length; ) {
            uint256 tokenId = tokenIds[i];
            _validateToken(tokenId);

            VoteRecord storage voteRecord = dispute.tokenVotes[tokenId];
            if (voteRecord.votedFor == VoteOption.Pending) revert Errors.TokenIdDidNotVote();
            if (voteRecord.isClaimed) revert Errors.AlreadyClaimedForTokenId();

            uint votePower = nftInfos[tokenId].power;
            uint reward = (votePower * ((dispute.disputerDeposit * (BPS - PROTOCOL_FEE)) / BPS)) / totalVoted;

            totalReward += reward;
            voteRecord.isClaimed = true;
            emit VoteRewardClaimed(msg.sender, _oracle, tokenId, dispute.marketToken, reward);
            unchecked {
                ++i;
            }
        }

        if (totalReward == 0) revert Errors.NoRewardsToClaim();
        dispute.marketToken.safeTransfer(msg.sender, totalReward);
        return true;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // CROSS-CHAIN VOTER
    ////////////////////////////////////////////////////////////////////////////////
    /// @notice Vote on REMOTE CHAIN disputes - verifies ownership and sends to remote
    /// @param _dstChainEid Destination chain where dispute exists
    /// @param _oracle Oracle address on remote chain
    /// @param _status Vote option
    /// @param tokenIds Array of tokenIds to vote with
    /// @param _options LayerZero execution options (use OptionsBuilder for large batches)
    ///
    /// @dev Gas Requirements:
    /// - Enforced minimum: 200k gas (set in LayerZero config)
    /// - Estimated cost: ~26k gas per NFT on remote chain
    /// - Recommended gas: 200k base + (26k * tokenIds.length)
    ///   * 1 NFT:   ~226k gas
    ///   * 10 NFTs: ~460k gas
    ///   * 100 NFTs: ~2.8M gas
    ///
    /// @dev CRITICAL: You pay for allocated gas, NOT actual gas used!
    /// - Over-allocating WASTES FEES (e.g., allocate 2.7M for 1 NFT = pay for 2.7M, only use ~100k)
    /// - Under-allocating CAUSES FAILURE (e.g., allocate 100k for 10 NFTs = out of gas revert)
    /// - LayerZero charges upfront based on allocation, unused gas is NOT refunded
    /// - Only excess msg.value is refunded, not unused gas allocation
    /// - Provide ACCURATE gas estimates to avoid overpaying LayerZero fees
    ///
    /// @dev Example for 100 NFTs:
    ///   Options.newOptions()
    ///     .addExecutorLzReceiveOption(2_500_000, 0)  // User: 2.5M gas
    ///     .toBytes()
    ///   Result: User 2.5M + Enforced 200k = 2.7M total (via combineOptions)
    function voteOnRemoteDispute(
        uint32 _dstChainEid,
        address _oracle,
        VoteOption _status,
        uint256[] calldata tokenIds,
        bytes calldata _options
    ) external payable {
        if (_status == VoteOption.Pending) revert Errors.CannotVoteForPending();
        uint length = tokenIds.length;
        if (length == 0) revert Errors.EmptyTokenIdsArray();

        // Lock NFTs for fixed period (unwrapCooldown = 60 hours)
        uint48 disputeLockEnd = uint48(block.timestamp + unwrapCooldown);

        // Verify ownership and NFT state on home chain
        uint96[] memory powers = new uint96[](length);

        for (uint i; i < length; ) {
            uint256 tokenId = tokenIds[i];
            _validateToken(tokenId);
            NFT storage nft = nftInfos[tokenId];
            if (nft.voteDisabledUntil >= block.timestamp) revert Errors.NFTLockedVotingCooldown();
            if (nft.validTo <= block.timestamp) revert Errors.NFTExpiredInStakingContract();

            // Extend NFT lock until dispute can be resolved
            if (nft.unstakeAvailableAt < disputeLockEnd) {
                nft.unstakeAvailableAt = disputeLockEnd;
            }

            powers[i] = nft.power;
            unchecked {
                ++i;
            }
        }

        // Send vote request to remote chain
        bytes memory payload = abi.encode(VOTE_MSG, msg.sender, _oracle, _status, tokenIds, powers);

        _lzSend(
            _dstChainEid,
            payload,
            combineOptions(_dstChainEid, VOTE_MSG, _options),
            MessagingFee(msg.value, 0),
            payable(msg.sender) // Excess msg.value refunded to caller on HOME chain
        );

        emit RemoteVoteSent(msg.sender, _oracle, _dstChainEid, tokenIds);
    }

    /// @notice Quote fee for voting on remote dispute
    function quoteVoteOnRemoteDispute(
        uint32 _dstChainEid,
        address _oracle,
        VoteOption _status,
        uint256[] calldata tokenIds,
        bytes calldata _options,
        bool _payInLzToken
    ) external view returns (MessagingFee memory fee) {
        uint length = tokenIds.length;
        uint96[] memory powers = new uint96[](tokenIds.length);
        for (uint i; i < length; ) {
            powers[i] = nftInfos[tokenIds[i]].power;
            unchecked {
                ++i;
            }
        }
        bytes memory payload = abi.encode(VOTE_MSG, msg.sender, _oracle, _status, tokenIds, powers);
        fee = _quote(_dstChainEid, payload, combineOptions(_dstChainEid, VOTE_MSG, _options), _payInLzToken);
    }

    /// @notice Claim rewards for REMOTE CHAIN disputes - verifies ownership and sends to remote
    /// @param _dstChainEid Destination chain where dispute exists
    /// @param _oracle Oracle address on remote chain
    /// @param tokenIds Array of tokenIds to claim rewards for
    /// @param _options LayerZero execution options (use OptionsBuilder for large batches)
    ///
    /// @dev Gas Requirements:
    /// - Enforced minimum: 250k gas (set in LayerZero config)
    /// - Recommended: Provide accurate gas estimates for large batches (see voteOnRemoteDispute)
    /// - Remember: You pay for allocated gas, not used gas - avoid over-allocating!
    function claimRewardsOnRemoteDispute(
        uint32 _dstChainEid,
        address _oracle,
        uint256[] calldata tokenIds,
        bytes calldata _options
    ) external payable {
        if (tokenIds.length == 0) revert Errors.EmptyTokenIdsArray();

        uint length = tokenIds.length;
        // Verify ownership on home chain
        for (uint i; i < length; ) {
            _validateToken(tokenIds[i]);
            unchecked {
                ++i;
            }
        }

        // Send claim request to remote chain
        bytes memory payload = abi.encode(CLAIM_MSG, msg.sender, _oracle, tokenIds);

        _lzSend(
            _dstChainEid,
            payload,
            combineOptions(_dstChainEid, CLAIM_MSG, _options),
            MessagingFee(msg.value, 0),
            payable(msg.sender) // Excess msg.value refunded to caller on HOME chain
        );

        emit RemoteClaimSent(msg.sender, _oracle, _dstChainEid, tokenIds);
    }

    /// @notice Quote fee for claiming on remote dispute
    function quoteClaimOnRemoteDispute(
        uint32 _dstChainEid,
        address _oracle,
        uint256[] calldata tokenIds,
        bytes calldata _options,
        bool _payInLzToken
    ) external view returns (MessagingFee memory fee) {
        bytes memory payload = abi.encode(CLAIM_MSG, msg.sender, _oracle, tokenIds);
        fee = _quote(_dstChainEid, payload, combineOptions(_dstChainEid, CLAIM_MSG, _options), _payInLzToken);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // DISPUTE RESOLUTION
    ////////////////////////////////////////////////////////////////////////////////

    function resolve(address _oracle) external {
        Dispute storage dispute = disputes[_oracle];
        if (dispute.state != DisputeState.Active) revert Errors.DisputeNotActive();
        if (block.timestamp <= dispute.endAt) revert Errors.VotingPeriodNotEnded();

        uint yes = dispute.votes[VoteOption.Yes];
        uint no = dispute.votes[VoteOption.No];
        uint unknown = dispute.votes[VoteOption.Unknown];
        uint total = yes + no + unknown;
        if (total == 0) revert Errors.NoOneVoted();

        uint maxVotes = yes;
        if (no > maxVotes) maxVotes = no;
        if (unknown > maxVotes) maxVotes = unknown;

        uint countWithMax;
        if (yes == maxVotes) countWithMax++;
        if (no == maxVotes) countWithMax++;
        if (unknown == maxVotes) countWithMax++;

        if (countWithMax > 1) {
            dispute.state = DisputeState.Failed;
            emit DisputeFailed(_oracle, dispute.disputer);
            return;
        }

        VoteOption winner;
        if (yes == maxVotes) {
            winner = VoteOption.Yes;
        } else if (no == maxVotes) {
            winner = VoteOption.No;
        } else {
            winner = VoteOption.Unknown;
        }

        address marketToken = dispute.marketToken;
        string memory reason;
        uint votersReward = (dispute.disputerDeposit * (BPS - PROTOCOL_FEE)) / BPS;
        if (winner == dispute.draftStatus) {
            (bool success, ) = vault.call(
                abi.encodeWithSignature("topUpDispute(address,uint256)", marketToken, votersReward)
            );
            if (!success) revert Errors.TopUpFailed();
            reason = dispute.reason;
        } else {
            marketToken.safeTransfer(vault, dispute.disputerDeposit - votersReward);
            reason = "";
        }
        dispute.finalStatus = winner;
        dispute.state = DisputeState.Resolved;
        _resolveArbitration(_oracle, winner, reason);
        emit DisputeResolved(_oracle, winner, msg.sender);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // PENALTY SYSTEM
    ////////////////////////////////////////////////////////////////////////////////

    function manageOperator(address _target, bool _approved) external onlyOwner {
        if (_target == address(0)) revert Errors.InvalidAddress();
        _operatorApproved[_target] = _approved;
        emit OperatorApproved(_target, _approved);
    }

    function setPenaltyToken(address _token) external onlyOwner {
        if (_token == address(0)) revert Errors.InvalidAddress();
        penaltyToken = _token;
        emit PenaltyTokenSet(_token);
    }

    function setPenalty(uint256 _tokenId, uint256 _amount) external {
        if (!_operatorApproved[msg.sender]) revert Errors.NotOperator();
        penalties[_tokenId] = _amount;
        emit PenaltySet(_tokenId, _amount);
    }

    function payPenalty(uint256 _tokenId) external {
        if (penaltyToken == address(0)) revert Errors.PenaltyTokenNotSet();
        uint256 amount = penalties[_tokenId];
        if (amount == 0) revert Errors.NoPenaltySet();
        penaltyToken.safeTransferFrom(msg.sender, vault, amount);
        penalties[_tokenId] = 0;
        emit PenaltyPaid(_tokenId, msg.sender, amount);
    }

    function setVoteCooldown(uint32 _cooldown) external onlyOwner {
        uint32 oldCooldown = voteCooldown;
        voteCooldown = _cooldown;
        emit VoteCooldownUpdated(oldCooldown, _cooldown);
    }

    function setUnwrapCooldown(uint32 _cooldown) external onlyOwner {
        uint32 oldCooldown = unwrapCooldown;
        unwrapCooldown = _cooldown;
        emit UnwrapCooldownUpdated(oldCooldown, _cooldown);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // GETTERS
    ////////////////////////////////////////////////////////////////////////////////

    /// @notice Calculate required collateral amount for opening a dispute
    /// @param oracle Oracle address to dispute
    /// @return collateralAmount Required collateral amount (1% of market TVL, min MINIMUM_COLLATERAL)
    /// @return collateralToken Address of the collateral token
    function getDisputeCollateral(
        address oracle
    ) public view returns (uint256 collateralAmount, address collateralToken) {
        address market = getMarketAddress(oracle);
        (uint256 tvl, address marketToken) = _getMarketInfo(market);
        uint256 calculated = tvl / COLLATERAL_DIVISOR;
        collateralAmount = calculated < MINIMUM_COLLATERAL ? MINIMUM_COLLATERAL : calculated;
        collateralToken = marketToken;
    }

    function getMarketAddress(address oracle) public view returns (address) {
        // First try AMM market
        (bool success, bytes memory response) = marketFactory.staticcall(
            abi.encodeWithSignature("getMarketByPoll(address)", oracle)
        );
        if (success) {
            address marketAddress = abi.decode(response, (address));
            if (marketAddress != address(0)) {
                return marketAddress;
            }
        }

        // Then try PariMutuel market
        (success, response) = marketFactory.staticcall(abi.encodeWithSignature("getPariMutuelByPoll(address)", oracle));
        if (success) {
            address marketAddress = abi.decode(response, (address));
            if (marketAddress != address(0)) {
                return marketAddress;
            }
        }

        // No market found
        revert Errors.MarketNotFound();
    }

    function getDisputeInfo(
        address oracle
    )
        external
        view
        returns (
            address disputer,
            bool isCollateralTaken,
            DisputeState state,
            VoteOption draftStatus,
            VoteOption finalStatus,
            uint disputerDeposit,
            uint endAt,
            address marketToken,
            string memory reason
        )
    {
        Dispute storage dispute = disputes[oracle];
        return (
            dispute.disputer,
            dispute.isCollateralTaken,
            dispute.state,
            dispute.draftStatus,
            dispute.finalStatus,
            dispute.disputerDeposit,
            dispute.endAt,
            dispute.marketToken,
            dispute.reason
        );
    }

    function getVoteCount(address oracle, VoteOption option) external view returns (uint) {
        return disputes[oracle].votes[option];
    }

    function getVoteRecordInfo(
        address oracle,
        uint256 tokenId
    ) external view returns (uint power, bool isClaimed, VoteOption votedFor) {
        VoteRecord storage voteRecord = disputes[oracle].tokenVotes[tokenId];
        uint votePower = voteRecord.votedFor != VoteOption.Pending ? nftInfos[tokenId].power : 0;
        return (votePower, voteRecord.isClaimed, voteRecord.votedFor);
    }

    function hasVoted(address oracle, uint256 tokenId) external view returns (bool) {
        return disputes[oracle].tokenVotes[tokenId].votedFor != VoteOption.Pending;
    }

    function canUnstake(uint tokenId) external view returns (bool) {
        return block.timestamp > nftInfos[tokenId].unstakeAvailableAt;
    }

    function canVote(uint tokenId) external view returns (bool) {
        NFT memory nft = nftInfos[tokenId];
        return nft.voteDisabledUntil < block.timestamp && nft.validTo > block.timestamp;
    }

    /// @notice Get unclaimed vote rewards for a tokenId with pagination
    /// @param tokenId Token ID
    /// @param offset Starting index
    /// @param limit Maximum number of results
    /// @return total Total number of unclaimed oracles
    /// @return oracles Array of oracle addresses with unclaimed rewards
    function getUnclaimedVoteRewards(
        uint256 tokenId,
        uint offset,
        uint limit
    ) external view returns (uint total, address[] memory oracles) {
        address[] storage allOracles = voteRewards[tokenId];
        total = allOracles.length;
        if (offset >= total) {
            return (total, new address[](0));
        }
        uint actualLimit = offset + limit > total ? total - offset : limit;
        oracles = new address[](actualLimit);
        uint index;
        for (uint i; i < actualLimit; ) {
            address candidate = allOracles[offset + i];
            if (!disputes[candidate].tokenVotes[tokenId].isClaimed) {
                oracles[index] = candidate;
                unchecked {
                    ++index;
                }
            }
            unchecked {
                ++i;
            }
        }
        // Trim array to actual unclaimed count
        assembly {
            mstore(oracles, index)
        }
    }

    ////////////////////////////////////////////////////////////////////////////////
    // INTERNAL HELPERS
    ////////////////////////////////////////////////////////////////////////////////

    function _validateToken(uint _tokenId) internal view {
        if (!_isAuthorized(ownerOf(_tokenId), msg.sender, _tokenId)) revert Errors.NotNFTOwnerOrApproved();
        if (_isBlocked(_tokenId)) revert Errors.TokenBlocked(_tokenId);
    }

    function _getMarketInfo(address market) internal view returns (uint256 collateralTvl, address marketToken) {
        (bool success, bytes memory response) = market.staticcall(abi.encodeWithSignature("marketState()"));
        if (!success) revert Errors.MarketInfo();
        (, collateralTvl, , marketToken) = abi.decode(response, (bool, uint256, uint24, address));
    }

    function _getTimeFromOracle(address oracle) internal view returns (uint256) {
        (bool success, bytes memory response) = oracle.staticcall(
            abi.encodeWithSignature("ARBITRATION_ESCALATION_PERIOD()")
        );
        if (!success) revert Errors.Fail();
        uint32 escalationPeriodEpochs = abi.decode(response, (uint32));
        return escalationPeriodEpochs * EPOCH_LENGTH;
    }

    function _canWeStartDispute(address _oracle, VoteOption _status) internal view returns (bool) {
        (bool success, bytes memory response) = _oracle.staticcall(abi.encodeWithSignature("getFinalizedStatus()"));
        if (!success) revert Errors.Fail();
        (bool isFinalized, VoteOption status) = (abi.decode(response, (bool, VoteOption)));
        return (!isFinalized && status != VoteOption.Pending && _status != status);
    }

    function _getAnonNftInfo(uint _tokenId) internal view returns (PositionData memory position) {
        (bool success, bytes memory response) = address(AnonStaking).staticcall(
            abi.encodeWithSignature("positionOf(uint256)", _tokenId)
        );
        if (!success) revert Errors.Fail();
        (position, ) = abi.decode(response, (PositionData, uint256));
    }

    function _isBlocked(uint256 _tokenId) internal view returns (bool) {
        return penalties[_tokenId] > 0;
    }

    function _startArbitration(address _oracle) internal {
        (bool success, ) = address(_oracle).call(abi.encodeWithSignature("startArbitration()"));
        if (!success) revert Errors.Fail();
    }

    function _resolveArbitration(address _oracle, VoteOption _status, string memory _reason) internal {
        (bool success, ) = address(_oracle).call(
            abi.encodeWithSignature("resolveArbitration(uint8,string)", uint8(_status), _reason)
        );
        if (!success) revert Errors.Fail();
    }

    function onERC721Received(address, address, uint256, bytes calldata) public virtual returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function _update(address to, uint256 tokenId, address auth) internal virtual override returns (address) {
        if (_isBlocked(tokenId)) revert Errors.TokenBlocked(tokenId);

        NFT memory nft = nftInfos[tokenId];
        if (block.timestamp <= nft.voteDisabledUntil) revert Errors.NFTLockedVotingCooldown();
        if (block.timestamp <= nft.unstakeAvailableAt) revert Errors.NFTLockedDisputeResolution();

        return super._update(to, tokenId, auth);
    }

    ////////////////////////////////////////////////////////////////////////////////
    // LAYERZERO RECEIVE - Home chain doesn't receive vote/claim messages
    ////////////////////////////////////////////////////////////////////////////////

    function _lzReceive(
        Origin calldata /* _origin */,
        bytes32 /* _guid */,
        bytes calldata /* _message */,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal virtual override {
        // Home chain only sends messages, doesn't receive them
        revert Errors.InvalidMessageType();
    }
}
