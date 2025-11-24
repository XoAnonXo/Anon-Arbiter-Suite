# Dispute Resolver - Cross-Chain Voting System

A LayerZero V2-powered cross-chain dispute resolution system for prediction markets, enabling NFT holders to vote on disputes across multiple chains.

## Overview

The Dispute Resolver system allows users to stake AnonStaking NFTs on the home chain (Sonic) and vote on disputes both locally and on remote chains (Base) through LayerZero's cross-chain messaging.

## Architecture

### Two-Contract System

1. **DisputeResolverHome** (Sonic Mainnet)
   - Wraps AnonStaking NFTs into voting NFTs (ERC721)
   - Manages local disputes for Sonic markets
   - Sends cross-chain vote/claim messages to remote chains
   - Verifies NFT ownership before sending messages

2. **DisputeResolverRemote** (Base Mainnet)
   - Manages disputes for Base markets
   - Receives votes from home chain via LayerZero
   - No ERC721 functionality (trusts home chain verification)
   - Processes claims and distributes rewards

### Cross-Chain Flow

```
Sonic (Home)                    LayerZero V2                    Base (Remote)
────────────                    ────────────                    ─────────────
1. User wraps NFTs
2. Dispute opened                                              Dispute opened
3. User votes locally
4. User votes remotely  ──────> Message sent ──────>          Vote recorded
5. Dispute resolved                                            Dispute resolved
6. User claims locally
7. User claims remotely ──────> Claim message ──────>         Rewards sent
```

## Key Features

- **NFT-Based Voting**: Voting power derived from staked AnonStaking NFT amounts
- **Cross-Chain Voting**: Vote on remote chain disputes without bridging NFTs
- **Dispute Management**: Open, vote, and resolve disputes with collateral requirements
- **Reward Distribution**: Voters receive proportional rewards from disputer deposits
- **Security Features**:
  - Double-vote prevention
  - NFT locking during active disputes
  - Penalty system for malicious actors
  - DVN-verified cross-chain messages

## Smart Contracts

### DisputeResolverHome.sol
- **Network**: Sonic Mainnet (Chain ID: 146)
- **LayerZero Endpoint ID**: 30332
- **Key Functions**:
  - `depositFor()` - Wrap AnonStaking NFTs
  - `withdrawTo()` - Unwrap NFTs
  - `vote()` - Vote on local disputes
  - `voteOnRemoteDispute()` - Send vote to remote chain
  - `claimRewardsOnRemoteDispute()` - Claim remote rewards

### DisputeResolverRemote.sol
- **Network**: Base Mainnet (Chain ID: 8453)
- **LayerZero Endpoint ID**: 30184
- **Key Functions**:
  - `openDispute()` - Create dispute for Base markets
  - `_processVote()` - Receive votes from home chain
  - `_processClaimRewards()` - Process remote claims
  - `resolve()` - Finalize dispute outcome

## LayerZero Configuration

### DVN Setup
- **Required DVNs**: LayerZero Labs, Nethermind
- **Security Model**: Both DVNs must verify messages
- **Confirmations**: 1 block on both chains

### Gas Configuration
- **Vote Message**: 200k base gas + ~26k per NFT
- **Claim Message**: 250k base gas
- **Important**: You pay for allocated gas, not used gas - avoid over-allocation!

## Development

### Prerequisites
```bash
node >= 18.16.0
npm or pnpm
```

### Installation
```bash
npm install
```

### Compile Contracts
```bash
npm run compile
# or separately:
npm run compile:hardhat  # TypeChain types
```

### Run Tests
```bash
npm test                 # All tests
npm run test:hardhat    # Hardhat tests
```

### Coverage
```bash
npx hardhat coverage
```

### Linting
```bash
npm run lint            # Check all
npm run lint:fix        # Fix automatically
npm run lint:sol        # Solidity only
npm run lint:js         # TypeScript/JS only
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed deployment instructions.

### Quick Deploy

1. **Configure environment**:
```bash
cp .env.example .env
# Add PRIVATE_KEY and RPC URLs
```

2. **Deploy contracts**:
```bash
# Deploy to Sonic (Home)
npx hardhat deploy --network sonic_mainnet --tags DisputeResolverHome

# Deploy to Base (Remote)
npx hardhat deploy --network base --tags DisputeResolverRemote
```

3. **Configure LayerZero**:
```bash
npx hardhat lz:oapp:wire --oapp-config layerzero.dispute.config.ts
```

## Usage Examples

### Wrap NFTs
```typescript
const tokenIds = [1, 2, 3];
await disputeResolverHome.depositFor(userAddress, tokenIds);
```

### Vote on Local Dispute
```typescript
await disputeResolverHome.vote(
  oracleAddress,
  VoteOption.Yes,
  [tokenId1, tokenId2]
);
```

### Vote on Remote Dispute (Cross-Chain)
```typescript
import { Options } from '@layerzerolabs/lz-v2-utilities';

const options = Options.newOptions()
  .addExecutorLzReceiveOption(250000, 0) // Gas for remote execution
  .toHex();

const fee = await disputeResolverHome.quoteVoteOnRemoteDispute(
  baseEid,
  oracleAddress,
  VoteOption.Yes,
  [tokenId1, tokenId2],
  options,
  false
);

await disputeResolverHome.voteOnRemoteDispute(
  baseEid,
  oracleAddress,
  VoteOption.Yes,
  [tokenId1, tokenId2],
  options,
  { value: fee.nativeFee }
);
```

## Gas Optimization Tips

1. **Batch operations** when possible
2. **Accurate gas estimates** for LayerZero messages
3. **Vote cooldown**: 60 hours prevents rapid re-voting
4. **Unwrap cooldown**: 60 hours after voting

## Security Considerations

- **Double-vote prevention**: NFTs can only vote once per dispute
- **NFT locking**: NFTs locked during active disputes
- **Cross-chain verification**: DVNs verify all cross-chain messages
- **Collateral requirements**: Minimum collateral to open disputes
- **Penalty system**: Operators can penalize malicious actors

## Constants

```solidity
BPS = 10,000                    // Basis points
PROTOCOL_FEE = 2,000           // 20% protocol fee
MINIMUM_COLLATERAL = 1e6       // Minimum dispute collateral
COLLATERAL_DIVISOR = 100       // TVL / 100 for collateral calculation
MAX_REASON_LENGTH = 200        // Max dispute reason length
VOTE_COOLDOWN = 60 hours       // Time before NFT can vote again
UNWRAP_COOLDOWN = 60 hours     // Time before NFT can be unwrapped
```

## Project Structure

```
dispute-resolver/
├── contracts/
│   ├── DisputeResolverHome.sol      # Home chain contract
│   ├── DisputeResolverRemote.sol    # Remote chain contract
│   ├── libraries/                    # Shared libraries
│   └── mocks/                        # Test mocks
├── deploy/                           # Deployment scripts
├── scripts/                          # Utility scripts
├── test/                             # Test files
├── layerzero.dispute.config.ts      # LayerZero configuration
└── DEPLOYMENT.md                     # Deployment guide
```

## License

MIT

## Resources

- [LayerZero V2 Documentation](https://docs.layerzero.network/v2)
- [LayerZero Scan](https://layerzeroscan.com)
- [Hardhat Documentation](https://hardhat.org)
- [Foundry Book](https://book.getfoundry.sh)

