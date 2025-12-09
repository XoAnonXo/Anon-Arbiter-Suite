// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import { OApp, Origin, MessagingFee } from "@layerzerolabs/oapp-evm/contracts/oapp/OApp.sol";
import { OAppOptionsType3 } from "@layerzerolabs/oapp-evm/contracts/oapp/libs/OAppOptionsType3.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { TransferHelper } from "./libraries/TransferHelper.sol";
import { Errors } from "./libraries/Errors.sol";

/// @title DisputeResolverRemote - Remote Chain Dispute Resolution
/// @notice Full dispute logic for REMOTE chain markets/oracles, NO ERC721
/// @dev Deployed on remote chains where markets exist but NFTs don't
///
/// Architecture:
/// 1. Remote chains have full dispute logic for THEIR markets/oracles
/// 2. NO ERC721 - cannot verify NFT ownership locally
/// 3. Receives NFT metadata from home chain for vote power calculation
/// 4. Receives votes via LayerZero from home chain (home verifies ownership)
/// 5. Users must vote through home chain DisputeResolverHome
contract DisputeResolverRemote is OApp, OAppOptionsType3 {
    using TransferHelper for address;

    uint private constant EPOCH_LENGTH = 5 minutes;
    uint private constant TIME_FOR_APPLY = 2 hours;
    uint public constant BPS = 10_000;
    uint public constant PROTOCOL_FEE = 2_000;
    uint public constant MINIMUM_COLLATERAL = 1e6;
    uint private constant COLLATERAL_DIVISOR = 100;
    uint public constant MAX_REASON_LENGTH = 200;

    uint32 public immutable homeChainEid;
    uint16 public constant VOTE_MSG = 1; // Vote request from home chain
    uint16 public constant CLAIM_MSG = 2; // Claim request from home chain
    address public immutable marketFactory;
    address public immutable vault;

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

    // No nftInfos needed - home chain validates and sends power with vote

    struct VoteRecord {
        bool isClaimed;
        VoteOption votedFor;
        uint96 power; // Store power used for this vote (sent from home chain)
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
    mapping(uint256 tokenId => address[] oracles) private voteRewards;

    event DisputeCreated(address disputer, address oracle, VoteOption draftStatus, uint amount, address marketToken);
    event CollateralTaken(address disputer, address oracle, uint amount, address marketToken);
    event Vote(address voter, address oracle, uint power, VoteOption status);
    event VoteRewardClaimed(address voter, address oracle, uint tokenId, address token, uint reward);
    event DisputeResolved(address oracle, VoteOption finalStatus, address resolver);
    event DisputeFailed(address oracle, address disputer);
    event CrossChainVoteReceived(address indexed voter, address indexed oracle, uint32 srcChainEid, uint256[] tokenIds);
    event CrossChainClaimReceived(
        address indexed claimer,
        address indexed oracle,
        uint32 srcChainEid,
        uint256[] tokenIds
    );

    constructor(
        address _layerZeroEndpoint,
        address _delegate,
        uint32 _homeChainEid,
        address _marketFactory,
        address _vault
    ) OApp(_layerZeroEndpoint, _delegate) Ownable(_delegate) {
        homeChainEid = _homeChainEid;
        marketFactory = _marketFactory;
        vault = _vault;
    }

    ////////////////////////////////////////////////////////////////////////////////
    // DISPUTER FUNCTIONALITY - REMOTE CHAIN DISPUTES
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
    // VOTER FUNCTIONALITY - ONLY VIA LAYERZERO FROM HOME CHAIN
    ////////////////////////////////////////////////////////////////////////////////
    // Users CANNOT vote directly here - must go through DisputeResolverHome
    // which verifies NFT ownership and sends message here

    function _processVote(
        address _voter,
        address _oracle,
        VoteOption _status,
        uint256[] memory tokenIds,
        uint96[] memory powers
    ) internal {
        Dispute storage dispute = disputes[_oracle];
        if (dispute.state != DisputeState.Active) revert Errors.DisputeNotActive();
        if (block.timestamp >= dispute.endAt) revert Errors.VotingPeriodEnded();
        uint length = tokenIds.length;
        if (length == 0) revert Errors.EmptyTokenIdsArray();
        if (length != powers.length) revert Errors.EmptyArray();

        uint totalPower;

        for (uint i; i < length; i++) {
            uint256 tokenId = tokenIds[i];
            // Record vote with power sent from home chain
            VoteRecord storage voteRecord = dispute.tokenVotes[tokenId];
            // Skip if already voted
            if (voteRecord.votedFor != VoteOption.Pending) continue;
            voteRecord.votedFor = _status;
            voteRecord.power = powers[i];
            totalPower += powers[i];
            // Track unclaimed vote reward
            voteRewards[tokenId].push(_oracle);
        }

        if (totalPower == 0) revert Errors.NoValidVotes();
        dispute.votes[_status] += totalPower;
        emit Vote(_voter, _oracle, totalPower, _status);
    }

    function _processClaimRewards(
        address _claimer,
        address _oracle,
        uint256[] memory tokenIds
    ) internal returns (uint totalReward) {
        Dispute storage dispute = disputes[_oracle];
        if (dispute.state != DisputeState.Resolved) revert Errors.DisputeNotResolved();
        uint length = tokenIds.length;
        if (length == 0) revert Errors.EmptyTokenIdsArray();

        uint totalVoted = dispute.votes[VoteOption.Yes] +
            dispute.votes[VoteOption.No] +
            dispute.votes[VoteOption.Unknown];

        for (uint i; i < length; ) {
            uint256 tokenId = tokenIds[i];

            VoteRecord storage voteRecord = dispute.tokenVotes[tokenId];
            if (voteRecord.votedFor == VoteOption.Pending) revert Errors.TokenIdDidNotVote();
            if (voteRecord.isClaimed) revert Errors.AlreadyClaimedForTokenId();

            // Use power stored from vote request
            uint votePower = voteRecord.power;
            uint reward = (votePower * ((dispute.disputerDeposit * (BPS - PROTOCOL_FEE)) / BPS)) / totalVoted;

            totalReward += reward;
            voteRecord.isClaimed = true;
            emit VoteRewardClaimed(_claimer, _oracle, tokenId, dispute.marketToken, reward);
            unchecked {
                ++i;
            }
        }

        if (totalReward == 0) revert Errors.NoRewardsToClaim();
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
            if (marketAddress != address(0)) return marketAddress;
        }

        // Then try PariMutuel market
        (success, response) = marketFactory.staticcall(abi.encodeWithSignature("getPariMutuelByPoll(address)", oracle));
        if (success) {
            address marketAddress = abi.decode(response, (address));
            if (marketAddress != address(0))  return marketAddress;
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
        return (voteRecord.power, voteRecord.isClaimed, voteRecord.votedFor);
    }

    function hasVoted(address oracle, uint256 tokenId) external view returns (bool) {
        return disputes[oracle].tokenVotes[tokenId].votedFor != VoteOption.Pending;
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

    function _getMarketInfo(address market) internal view returns (uint256 collateralTvl, address marketToken) {
        (bool success, bytes memory response) = market.staticcall(abi.encodeWithSignature("marketState()"));
        if (!success) revert Errors.MarketInfo();
        (, collateralTvl, , marketToken) = abi.decode(response, (bool, uint256, uint32, address));
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

    ////////////////////////////////////////////////////////////////////////////////
    // LAYERZERO RECEIVE - Handle messages from home chain
    ////////////////////////////////////////////////////////////////////////////////

    function _lzReceive(
        Origin calldata _origin,
        bytes32 /* _guid */,
        bytes calldata _message,
        address /* _executor */,
        bytes calldata /* _extraData */
    ) internal virtual override {
        // Only accept messages from home chain
        if (_origin.srcEid != homeChainEid) revert Errors.InvalidMessageType();

        // Decode only the first 32 bytes to check message type
        uint16 msgType = abi.decode(_message, (uint16));

        if (msgType == VOTE_MSG) {
            // Receive vote from home chain
            (
                ,
                address voter,
                address oracle,
                VoteOption status,
                uint256[] memory tokenIds,
                uint96[] memory powers
            ) = abi.decode(_message, (uint16, address, address, VoteOption, uint256[], uint96[]));

            _processVote(voter, oracle, status, tokenIds, powers);
            emit CrossChainVoteReceived(voter, oracle, _origin.srcEid, tokenIds);
        } else if (msgType == CLAIM_MSG) {
            // Receive claim request from home chain
            (, address claimer, address oracle, uint256[] memory tokenIds) = abi.decode(
                _message,
                (uint16, address, address, uint256[])
            );

            uint totalReward = _processClaimRewards(claimer, oracle, tokenIds);

            // Send rewards directly to claimer on THIS chain (remote chain has the tokens)
            Dispute storage dispute = disputes[oracle];
            dispute.marketToken.safeTransfer(claimer, totalReward);

            emit CrossChainClaimReceived(claimer, oracle, _origin.srcEid, tokenIds);
        } else {
            revert Errors.InvalidMessageType();
        }
    }
}
