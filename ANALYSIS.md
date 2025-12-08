# Overview

This is a **cross-chain dispute resolution system** for prediction markets, built with **LayerZero V2** to enable NFT holders to vote on market disputes across different blockchains. It's designed for Polymarket-style prediction markets.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SYSTEM ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SONIC MAINNET (Home Chain)              BASE MAINNET (Remote Chain)         │
│  ═══════════════════════════             ════════════════════════════        │
│                                                                              │
│  ┌─────────────────────────┐             ┌─────────────────────────┐        │
│  │  DisputeResolverHome    │◄─────────►  │  DisputeResolverRemote  │        │
│  │  - ERC721 (Voting NFTs) │  LayerZero  │  - NO ERC721            │        │
│  │  - Local disputes       │  Messages   │  - Remote disputes      │        │
│  │  - Cross-chain voting   │             │  - Receives votes       │        │
│  └──────────┬──────────────┘             └──────────┬──────────────┘        │
│             │                                       │                        │
│  ┌──────────▼──────────────┐             ┌─────────▼────────────────┐       │
│  │    AnonStaking NFTs     │             │   Markets on Base        │       │
│  │    (Staked positions)   │             │   (Prediction markets)   │       │
│  └─────────────────────────┘             └──────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## How It Works

### 1. **NFT Wrapping (Home Chain Only)**

Users must first "wrap" their AnonStaking NFTs to participate in voting:

```solidity
// Deposit AnonStaking NFTs to get voting power
function depositFor(address account, uint256[] memory tokenIds) public returns (bool)
```

- Only accepts **1-year staked NFTs** (pool index 2)
- Creates a wrapped ERC721 token with the same tokenId
- Stores voting power based on staked amount
- Enforces cooldown periods before voting/unstaking

### 2. **Opening a Dispute**

Anyone can dispute a market's oracle result by depositing collateral:

```solidity
function openDispute(address _oracle, VoteOption _status, string calldata _reason) external
```

**How collateral is calculated:**

```solidity
uint calculated = _getMarketTVL(market) / COLLATERAL_DIVISOR; // TVL / 100
uint amount = calculated < MINIMUM_COLLATERAL ? MINIMUM_COLLATERAL : calculated;
// Minimum is 1e6 (1 USDC)
```

**Vote options:**
- `Yes` (1) - Market resolved correctly
- `No` (2) - Market resolved incorrectly  
- `Unknown` (3) - Outcome cannot be determined

### 3. **Voting Mechanism**

#### Local Voting (Same Chain)

```solidity
function vote(address _oracle, VoteOption _status, uint256[] calldata tokenIds) external
```

#### Cross-Chain Voting (From Sonic to Base)

```solidity
function voteOnRemoteDispute(
    uint32 _dstChainEid,      // 30184 for Base
    address _oracle,           // Oracle on Base
    VoteOption _status,        // Vote choice
    uint256[] calldata tokenIds,
    bytes calldata _options    // LayerZero gas options
) external payable
```

**Cross-chain flow:**
1. User calls `voteOnRemoteDispute()` on Sonic
2. Home contract verifies NFT ownership and locks NFTs
3. Sends LayerZero message with voter, oracle, vote option, tokenIds, and powers
4. Remote contract receives and processes vote via `_lzReceive()`
5. Vote power is recorded on the remote chain

### 4. **Dispute Resolution**

After the voting period ends, anyone can resolve:

```solidity
function resolve(address _oracle) external
```

**Resolution logic:**
1. Count votes for Yes, No, Unknown
2. Winner = option with most votes
3. If tie → Dispute `Failed`
4. If winner matches disputer's proposal → disputer gets collateral back
5. If winner differs → collateral goes to voters as rewards

**Fee distribution:**
- **80%** goes to voters (proportional to voting power)
- **20%** goes to protocol (Vault)

### 5. **Claiming Rewards**

#### Local Claims

```solidity
function claimVoteRewards(address _oracle, uint256[] calldata tokenIds) external returns (bool)
```

#### Cross-Chain Claims

```solidity
function claimRewardsOnRemoteDispute(
    uint32 _dstChainEid,
    address _oracle,
    uint256[] calldata tokenIds,
    bytes calldata _options
) external payable
```

---

## Key Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `BPS` | 10,000 | Basis points for percentage calculations |
| `PROTOCOL_FEE` | 2,000 | 20% fee to protocol |
| `MINIMUM_COLLATERAL` | 1e6 | Minimum 1 USDC collateral |
| `COLLATERAL_DIVISOR` | 100 | TVL/100 = required collateral |
| `MAX_REASON_LENGTH` | 200 | Max chars for dispute reason |
| `VOTE_COOLDOWN` | 60 hours | Time before NFT can vote again |
| `UNWRAP_COOLDOWN` | 60 hours | Time before NFT can be unwrapped |

---

## Security Features

### 1. **Double-Vote Prevention**
```solidity
if (dispute.tokenVotes[tokenId].votedFor != VoteOption.Pending) continue;
```

### 2. **NFT Locking During Disputes**
```solidity
if (nft.unstakeAvailableAt < disputeLockEnd) {
    nft.unstakeAvailableAt = disputeLockEnd;
}
```

### 3. **Penalty System**
Operators can penalize malicious actors:
```solidity
function setPenalty(uint256 _tokenId, uint256 _amount) external
function payPenalty(uint256 _tokenId) external
```

Blocked NFTs cannot:
- Vote
- Be transferred
- Be unwrapped

### 4. **DVN Verification**
LayerZero messages require verification from both:
- LayerZero Labs DVN
- Nethermind DVN

---

## LayerZero Integration

### Message Types

| Type | ID | Description | Gas |
|------|----|----|-----|
| `VOTE_MSG` | 1 | Send vote to remote | 200k base + ~26k/NFT |
| `CLAIM_MSG` | 2 | Claim rewards from remote | 250k base |

### Configuration

```typescript
// layerzero.dispute.config.ts
const EVM_ENFORCED_OPTIONS = [
    { msgType: 1, gas: 200000 }, // VOTE
    { msgType: 2, gas: 250000 }, // CLAIM
]

const pathways = [
    [sonicHomeContract, baseRemoteContract, 
     [['LayerZero Labs', 'Nethermind'], []], // Required DVNs
     [3, 3], // Block confirmations
     [EVM_ENFORCED_OPTIONS, EVM_ENFORCED_OPTIONS]]
]
```

---

## Contract Interactions

### Vault Contract

The `Vault.sol` handles protocol fees and rewards:

```solidity
// Only approved resolvers can call
function topUpDispute(address _token, uint256 _amount) external
```

### Oracle Interaction

The system calls oracles to:
1. Start arbitration: `oracle.startArbitration()`
2. Resolve arbitration: `oracle.resolveArbitration(status, reason)`
3. Check status: `oracle.getFinalizedStatus()`

### Market Factory Interaction

Links oracles to markets:
```solidity
marketFactory.getMarketByPoll(oracle) → market
market.collateralToken() → token
market.getReserves() → TVL
```

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         COMPLETE DISPUTE LIFECYCLE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. WRAP NFTs                                                                │
│     User → depositFor(tokenIds) → Gets wrapped voting NFTs                   │
│                                                                              │
│  2. OPEN DISPUTE                                                             │
│     Disputer → openDispute(oracle, status, reason)                          │
│     Deposits collateral (TVL/100 or min 1 USDC)                             │
│                                                                              │
│  3. VOTING PERIOD (until endAt)                                             │
│     ┌─────────────────────┐    ┌─────────────────────┐                      │
│     │ Local Vote (Sonic)  │    │ Remote Vote (Base)  │                      │
│     │ vote(oracle,status) │    │ voteOnRemoteDispute │                      │
│     └─────────────────────┘    └─────────┬───────────┘                      │
│                                          │                                   │
│                                 LayerZero│Message                           │
│                                          ▼                                   │
│                                ┌─────────────────────┐                      │
│                                │ DisputeResolverRemote│                     │
│                                │ _processVote()       │                     │
│                                └─────────────────────┘                      │
│                                                                              │
│  4. RESOLUTION (after voting period)                                        │
│     Anyone → resolve(oracle)                                                │
│     - Count votes: Yes vs No vs Unknown                                      │
│     - Winner = max votes (tie = Failed)                                      │
│     - 80% to voters, 20% to protocol                                         │
│                                                                              │
│  5. CLAIM REWARDS                                                            │
│     ┌───────────────────────┐    ┌─────────────────────────┐               │
│     │ Local: claimVoteRewards│   │ Remote: claimRewardsOn... │              │
│     │ (direct transfer)      │   │ (LayerZero message)       │              │
│     └───────────────────────┘    └─────────────────────────┘               │
│                                                                              │
│  6. DISPUTER COLLATERAL                                                      │
│     If dispute passed → takeCollateral() → get collateral back              │
│     If dispute failed → collateral distributed to voters                     │
│                                                                              │
│  7. UNWRAP NFTs (after cooldown)                                            │
│     User → withdrawTo(tokenIds) → Get original NFTs back                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployed Contracts

### Sonic Mainnet (Home Chain - EID: 30332)
| Contract | Address |
|----------|---------|
| DisputeResolverHome | `0x282634e467b4c96057820D05F83981bfB8fEfCBD` |
| Vault | `0xFfe97cfE5fa7e97c3268faB005B235DD999a8812` |
| MockAnonStaking | `0xDE3d4D62CCA3C506106e78FF74c560ED8d605C8B` |
| MockMarketFactory | `0x31BAE9927929A6F2854d08Bd119fB7b2e12C03Ae` |
| LayerZero Endpoint | `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` |

### Base Mainnet (Remote Chain - EID: 30184)
| Contract | Address |
|----------|---------|
| DisputeResolverRemote | `0xdA0C272103179bC72EAc88885e11F859979B5e7E` |
| Vault | `0x7EAc7789aa3C9cc44E9BA3aB50463A5b1A9F18c4` |
| MockMarketFactory | `0xEc679E883E8b7340bc6dB97BeFf1a1bc3212da7D` |
| LayerZero Endpoint | `0x1a44076050125825900e736c501f859c50fE728c` |

---

## Summary

This is a sophisticated cross-chain governance system that:

1. **Wraps NFTs** to create voting power from staked positions
2. **Enables disputes** against oracle/market resolutions
3. **Allows cross-chain voting** via LayerZero without bridging NFTs
4. **Distributes rewards** proportionally to voters
5. **Protects against abuse** via cooldowns, penalties, and DVN verification




