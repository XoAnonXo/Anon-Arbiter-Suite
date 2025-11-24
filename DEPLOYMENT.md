# Dispute Resolver - Deployment Guide

## Architecture Overview

**Sonic Mainnet (Home Chain, EID: 30332)**
- DisputeResolverHome - Full ERC721 + dispute logic for Sonic markets
- MockAnonStaking - Staking NFT contract
- Vault - Protocol fee vault

**Base Mainnet (Remote Chain, EID: 30184)**
- DisputeResolverRemote - No ERC721, dispute logic for Base markets
- MockOracle, MockMarket, MockMarketFactory - Test contracts
- MockERC20 (USDC) - Collateral token
- Vault - Protocol fee vault

## Prerequisites

1. Set environment variables in `.env`:
```bash
PRIVATE_KEY=your_private_key_here
```

2. Ensure you have native tokens for gas:
   - Sonic: S tokens
   - Base: ETH

## Deployment Steps

### Step 1: Deploy to Sonic (Home Chain)

```bash
npx hardhat deploy --network sonic_mainnet --tags SonicHome
```

**Deploys:**
- MockAnonStaking
- MockMarketFactory
- Vault
- DisputeResolverHome
- Approves DisputeResolverHome in Vault

**Save the output addresses!**

### Step 2: Deploy to Base (Remote Chain)

```bash
npx hardhat deploy --network base --tags BaseRemote
```

**Deploys:**
- MockERC20 (USDC, 6 decimals)
- MockOracle
- MockMarket (TVL: 100M USDC)
- MockMarketFactory
- Vault
- DisputeResolverRemote (homeChainEid = 30332)
- Links Oracle -> Market in factory
- Configures Oracle (not finalized, status=Yes)
- Mints 10M USDC to deployer
- Approves DisputeResolverRemote in Vault

**Save the output addresses!**

### Step 3: Configure LayerZero Peers

After both deployments, configure peer connections using LayerZero toolbox:

**Method 1: Using LayerZero Config (Recommended)**
```bash
# Wire connections on both chains (single command)
npx hardhat lz:oapp:wire --oapp-config layerzero.dispute.config.ts

# Or run per-network:
npx hardhat lz:oapp:wire --oapp-config layerzero.dispute.config.ts --network sonic_mainnet
npx hardhat lz:oapp:wire --oapp-config layerzero.dispute.config.ts --network base
```

**Method 2: Using Manual Script**
```bash
# Update addresses in scripts/configurePeers.ts first
npx hardhat run scripts/configurePeers.ts --network sonic_mainnet
npx hardhat run scripts/configurePeers.ts --network base
```

## Deployed Contracts

### Sonic Mainnet (Home Chain)
```
MockAnonStaking:       0x...
MockMarketFactory:     0x...
Vault:                 0x...
DisputeResolverHome:   0x...
```

### Base Mainnet (Remote Chain)
```
MockERC20 (USDC):        0x...
MockOracle:              0x...
MockMarket:              0x...
MockMarketFactory:       0x...
Vault:                   0x...
DisputeResolverRemote:   0x...
```

## Testing Flow

### 1. Wrap NFTs on Sonic (Home Chain)
```solidity
// Mint test NFT in MockAnonStaking
anonStaking.mint(user, tokenId);
anonStaking.setPosition(tokenId, 1000e18, 2, block.timestamp + 365 days, currentDay);

// Approve and deposit
anonStaking.approve(disputeResolverHome, tokenId);
disputeResolverHome.depositFor(user, [tokenId]);
```

### 2. Open Dispute on Base (Remote Chain)
```solidity
// Approve collateral (required: 1M USDC)
usdc.approve(disputeResolverRemote, 1_000_000 * 1e6);

// Open dispute
disputeResolverRemote.openDispute(
    oracleAddress,
    2, // VoteOption.No
    "Dispute reason"
);
```

### 3. Vote from Sonic on Base Dispute
```solidity
// On Sonic: Vote on remote dispute
disputeResolverHome.voteOnRemoteDispute{value: lzFee}(
    30184,              // Base EID
    oracleAddress,      // Oracle on Base
    2,                  // VoteOption.No
    [tokenId1, tokenId2],
    lzOptions
);
```

### 4. Resolve Dispute on Base
```solidity
// After voting period ends
disputeResolverRemote.resolve(oracleAddress);
```

### 5. Claim Rewards from Sonic
```solidity
// On Sonic: Claim rewards from Base dispute
disputeResolverHome.claimRewardsOnRemoteDispute{value: lzFee}(
    30184,              // Base EID
    oracleAddress,
    [tokenId1, tokenId2],
    lzOptions
);
```

## LayerZero Configuration

Update `layerzero.config.ts` with deployed addresses:

```typescript
export default {
    contracts: [
        {
            contract: 'DisputeResolverHome',
            address: '0x...', // From Sonic deployment
        },
        {
            contract: 'DisputeResolverRemote',
            address: '0x...', // From Base deployment
        },
    ],
    connections: [
        {
            from: 'DisputeResolverHome',
            to: 'DisputeResolverRemote',
        },
        {
            from: 'DisputeResolverRemote',
            to: 'DisputeResolverHome',
        },
    ],
}
```

## Useful Commands

### Check deployment
```bash
npx hardhat deployments --network sonic_mainnet
npx hardhat deployments --network base
```

### Verify contracts
```bash
npx hardhat verify --network sonic_mainnet <address> <constructor-args>
npx hardhat verify --network base <address> <constructor-args>
```

### Get contract sizes
```bash
npx hardhat compile --force
```

## LayerZero Endpoints

- **Sonic Mainnet**: `0x6F475642a6e85809B1c36Fa62763669b1b48DD5B` (EID: 30332)
- **Base Mainnet**: `0x1a44076050125825900e736c501f859c50fE728c` (EID: 30184)