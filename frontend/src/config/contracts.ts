/**
 * Contract Configuration
 * 
 * This file contains all contract addresses, ABIs, and related constants
 * for the Arbiter Suite protocol on Sonic Mainnet.
 */

/**
 * Contract addresses on Sonic Mainnet (Chain ID: 146)
 */
export const CONTRACTS = {
  // Arbiter Suite contracts (redeployed Dec 8, 2024 with real MarketFactory)
  DISPUTE_RESOLVER_HOME: '0xd447C3a4f4CA6036c2e51ccD0aCB45F7BFb1a5BE',
  ANON_STAKING: '0x780aE218A02A20b69aC3Da7Bf80c08A70A330a5e',
  VAULT: '0xebe5930DF4E11b496fe8d55D1e7aAc76BB7eeE73',
  
  // Production Sonic Market contracts
  USDC: '0xc6020e5492c2892fD63489797ce3d431ae101d5e',
  MARKET_FACTORY: '0x017277d36f80422a5d0aA5B8C93f5ae57BA2A317',
  ORACLE: '0x9492a0c32Fb22d1b8940e44C4D69f82B6C3cb298',
  
  // Standard addresses
  MULTICALL3: '0xcA11bde05977b3631167028862bE2a173976CA11',
} as const;

/** Scale factors for the protocol */
export const SCALE = {
  ONE: BigInt('1000000000000000000'),        // 10^18 Wei precision
  BPS_DENOMINATOR: 1_000_000,                 // Fee denominator (Uniswap V3 style)
  CANDLE_PRICE_SCALE: 1_000_000_000,          // Price/odds scale
  EPOCH_LENGTH: 300,                          // 5 minutes per epoch
  USDC_DECIMALS: 6,                           // USDC has 6 decimals
} as const;

/** Backend indexer URL for faster dispute queries */
export const INDEXER_URL = 'https://sonicmarketindexer-production.up.railway.app';

/** Sonic Mainnet chain configuration for wallet connections */
export const SONIC_CHAIN = {
  id: 146,
  name: 'Sonic',
  nativeCurrency: {
    decimals: 18,
    name: 'Sonic',
    symbol: 'S',
  },
  rpcUrls: {
    default: { http: ['https://rpc.soniclabs.com'] },
    public: { http: ['https://rpc.soniclabs.com'] },
  },
  blockExplorers: {
    default: { name: 'SonicScan', url: 'https://sonicscan.org' },
  },
} as const;

/**
 * DisputeResolverHome ABI
 * Contains read/write functions for dispute management and voting
 */
export const DISPUTE_RESOLVER_ABI = [
  // Read functions
  'function getDisputeInfo(address oracle) view returns (address disputer, bool isCollateralTaken, uint8 state, uint8 draftStatus, uint8 finalStatus, uint256 disputerDeposit, uint256 endAt, address marketToken, string reason)',
  'function getVoteCount(address oracle, uint8 option) view returns (uint256)',
  'function getVoteRecordInfo(address oracle, uint256 tokenId) view returns (uint256 power, bool isClaimed, uint8 votedFor)',
  'function hasVoted(address oracle, uint256 tokenId) view returns (bool)',
  'function nftInfos(uint256 tokenId) view returns (uint96 power, uint48 voteDisabledUntil, uint48 unstakeAvailableAt, uint48 validTo)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function canVote(uint256 tokenId) view returns (bool)',
  'function getRequiredCollateral(address oracle) view returns (uint256)',
  'function getCoinForMarket(address market) view returns (address)',
  'function getMarketAddress(address oracle) view returns (address)',
  'function penalties(uint256 tokenId) view returns (uint256)',
  'function penaltyToken() view returns (address)',
  'function getUnclaimedVoteRewards(uint256 tokenId, uint256 offset, uint256 limit) view returns (uint256 total, address[] oracles)',
  
  // Write functions
  'function vote(address oracle, uint8 status, uint256[] tokenIds)',
  'function depositFor(address account, uint256[] tokenIds) returns (bool)',
  'function withdrawTo(address account, uint256[] tokenIds) returns (bool)',
  'function claimVoteRewards(address oracle, uint256[] tokenIds) returns (bool)',
  'function openDispute(address oracle, uint8 status, string reason)',
  'function payPenalty(uint256 tokenId)',
  
  // Events
  'event Vote(address indexed voter, address indexed oracle, uint256 power, uint8 status)',
  'event DisputeCreated(address indexed disputer, address indexed oracle, uint8 draftStatus, uint256 amount, address marketToken)',
  'event DisputeResolved(address indexed oracle, uint8 finalStatus, address resolver)',
] as const;

/** Protocol constants from the contract */
export const PROTOCOL_CONSTANTS = {
  PROTOCOL_FEE_BPS: 2000, // 20% protocol fee
  BPS: 10000, // Basis points denominator
  VOTERS_SHARE_BPS: 8000, // 80% goes to voters (BPS - PROTOCOL_FEE)
} as const;

/**
 * ERC20 ABI for token approvals
 */
export const ERC20_ABI = [
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
] as const;

/**
 * AnonStaking ABI
 * Functions for staking NFT management
 */
export const ANON_STAKING_ABI = [
  'function mint(address to, uint256 tokenId)',
  'function setPosition(uint256 tokenId, uint96 amount, uint8 poolId, uint64 lockedUntil, uint64 lastPaidDay)',
  'function approve(address to, uint256 tokenId)',
  'function balanceOf(address owner) view returns (uint256)',
  'function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function positionOf(uint256 tokenId) view returns (tuple(uint96 amount, uint8 poolId, uint64 lockedUntil, uint64 lastPaidDay), uint256)',
] as const;

/**
 * Poll (Oracle) ABI
 * Functions for querying poll/oracle status
 */
export const POLL_ABI = [
  'function getArbiter() view returns (address)',
  'function getFinalizedStatus() view returns (bool isFinalized, uint8 status)',
  'function getStatus() view returns (uint8)',
  'function arbitrationStarted() view returns (bool)',
  'function ARBITRATION_ESCALATION_PERIOD() view returns (uint32)',
] as const;

/**
 * Market ABI - AMM markets
 * Functions for querying AMM market data
 */
export const AMM_MARKET_ABI = [
  'function collateralToken() view returns (address)',
  'function getReserves() view returns (uint112 r0, uint112 r1, uint256 r2, uint256 r3, uint256 tvl)',
] as const;

/**
 * Market ABI - Parimutuel markets  
 * Functions for querying Parimutuel market data
 */
export const PARIMUTUEL_MARKET_ABI = [
  'function collateralToken() view returns (address)',
  'function marketState() view returns (bool isLive, uint256 collateralTvl, uint24 yesChance, address collateral)',
] as const;

/** Event signatures for MarketCreated events from MarketFactory */
export const AMM_MARKET_CREATED_EVENT_SIG = '0xf5b2abb382b9f0eb4f933cd3f370115f4954022578022da4cd1e409828273b7c';
export const PARI_MARKET_CREATED_EVENT_SIG = '0x836dd531f538df807bcf0fef473f25364dbaf59f39be038e49939f6087533b05';

/** @deprecated Use AMM_MARKET_CREATED_EVENT_SIG or PARI_MARKET_CREATED_EVENT_SIG instead */
export const MARKET_CREATED_EVENT_SIG = AMM_MARKET_CREATED_EVENT_SIG;

/**
 * Multicall3 ABI for batching contract reads
 */
export const MULTICALL3_ABI = [
  'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[])',
  'function aggregate3Value(tuple(address target, bool allowFailure, uint256 value, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[])',
] as const;

export const VoteOption = {
  Pending: 0,
  Yes: 1,
  No: 2,
  Unknown: 3,
} as const;
export type VoteOption = (typeof VoteOption)[keyof typeof VoteOption];

export const DisputeState = {
  NotActive: 0,
  Active: 1,
  Resolved: 2,
  Failed: 3,
} as const;
export type DisputeState = (typeof DisputeState)[keyof typeof DisputeState];

export const VOTE_LABELS: Record<VoteOption, string> = {
  [VoteOption.Pending]: 'Pending',
  [VoteOption.Yes]: 'Yes - Correct',
  [VoteOption.No]: 'No - Incorrect',
  [VoteOption.Unknown]: 'Unknown',
};

export const STATE_LABELS: Record<DisputeState, string> = {
  [DisputeState.NotActive]: 'Not Active',
  [DisputeState.Active]: 'Active',
  [DisputeState.Resolved]: 'Resolved',
  [DisputeState.Failed]: 'Failed',
};


