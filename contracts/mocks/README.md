# Mock Contracts for DisputeResolver Testing

## Overview

Mock contracts for testing DisputeResolverHome and DisputeResolverRemote functionality.

## Contracts

### 1. MockMarketFactory
Factory contract that maps oracles to markets. Supports both AMM and PariMutuel market types.

**Functions:**
- `setAMMMarket(address oracle, address market)` - Set AMM market for an oracle (owner only)
- `setPariMutuelMarket(address oracle, address market)` - Set PariMutuel market for an oracle (owner only)
- `getMarketByPoll(address oracle)` - Get AMM market address by oracle
- `getPariMutuelByPoll(address oracle)` - Get PariMutuel market address by oracle

### 2. MockOracle
Oracle contract with configurable dispute resolution parameters.

**Functions:**
- `setEscalationPeriod(uint32 period)` - Set arbitration escalation period in epochs (owner only)
- `setStatus(bool isFinalized, VoteOption status)` - Set finalized status (owner only)
- `getFinalizedStatus()` - Get current finalized status
- `startArbitration()` - Called by DisputeResolver when dispute opens
- `resolveArbitration(uint8 status, string reason)` - Called by DisputeResolver when dispute resolves
- `reset()` - Reset oracle state for new test (owner only)

**VoteOption Enum:**
- `0` = Pending
- `1` = Yes
- `2` = No
- `3` = Unknown

### 3. MockMarket
Market contract with configurable TVL and market state. Supports both AMM and PariMutuel interfaces.

**Functions:**
- `setCollateralToken(address token)` - Set collateral token (owner only)
- `setTVL(uint256 tvl)` - Set total value locked (owner only)
- `setIsLive(bool isLive)` - Set market live status (owner only)
- `setYesChance(uint24 yesChance)` - Set YES chance (0-1000000 = 0-100%, owner only)
- `marketState()` - Universal: Get market state (isLive, collateralTvl, yesChance, collateral) - works for both AMM and PariMutuel
- `collateralToken()` - Get collateral token address

### 4. MockERC20
Standard ERC20 token for testing deposits and rewards.

**Functions:**
- `mint(address to, uint256 amount)` - Mint tokens (owner only)
- `burn(address from, uint256 amount)` - Burn tokens (owner only)
- `mintToSelf(uint256 amount)` - Mint to msg.sender (anyone)

## Example Usage

### Setup

```solidity
// 1. Deploy mock ERC20 for collateral
MockERC20 collateralToken = new MockERC20("USD Coin", "USDC", 6);

// 2. Deploy mock market
MockMarket market = new MockMarket(address(collateralToken));

// 3. Deploy mock oracle
MockOracle oracle = new MockOracle();

// 4. Deploy mock factory
MockMarketFactory factory = new MockMarketFactory();

// 5. Connect oracle to market in factory
// For AMM markets:
factory.setAMMMarket(address(oracle), address(market));
// Or for PariMutuel markets:
factory.setPariMutuelMarket(address(oracle), address(market));


// 6. Deploy DisputeResolverRemote
DisputeResolverRemote resolver = new DisputeResolverRemote(
    lzEndpoint,
    delegate,
    homeChainEid,
    address(factory),
    vaultAddress
);
```

### Configure Test Scenario

```solidity
// Set TVL for testing (1M USDC)
market.setTVL(ethers.utils.parseUnits('1000000', 18)); // 1M USDC (18 decimals)

// Set market as live
market.setIsLive(true);

// Set YES chance to 70%
market.setYesChance(700000); // 700000 / 1000000 = 70%

// Set oracle as not finalized with Yes status (dispute can start)
oracle.setStatus(false, MockOracle.VoteOption.Yes);

// Default escalation period is 432 epochs (36 hours, matches PredictionPoll)
// Can be changed for faster testing, or use hardhat time manipulation
oracle.setEscalationPeriod(12); // Fast test: 12 epochs = 60 minutes

// Mint collateral to disputer
collateralToken.mint(disputer, ethers.utils.parseUnits('10000', 18)); // 10k USDC (18 decimals)
```

### Open Dispute

```solidity
// Approve collateral (required: 1% of TVL = 10k USDC minimum)
collateralToken.approve(address(resolver), ethers.utils.parseUnits('10000', 18));

// Open dispute
resolver.openDispute(
    address(oracle),
    DisputeResolverRemote.VoteOption.No,
    "Market manipulation detected"
);
```

### Testing Cross-Chain Voting

```solidity
// On home chain: Send vote message
resolverHome.voteOnRemoteDispute(
    arbitrumChainEid,
    address(oracle),
    VoteOption.No,
    [tokenId1, tokenId2],
    lzOptions
);

// Remote chain receives vote via _lzReceive automatically
```

## Configuration Scenarios

### Scenario 1: High TVL Market (18 decimals)
```solidity
market.setTVL(ethers.utils.parseUnits('1000000000', 18)); // 1B USDC
// Required collateral: 1B / 100 = 10M USDC
```

### Scenario 2: Low TVL Market (18 decimals)
```solidity
market.setTVL(ethers.utils.parseUnits('5', 18)); // 5 USDC
// Required collateral: MIN_COLLATERAL = 1M (1e6 in contract, regardless of token decimals)
```

### Scenario 3: Closed Market
```solidity
market.setIsLive(false); // Market is closed
// This affects the isLive return value from marketState()
```

### Scenario 4: Custom Market Probability
```solidity
market.setYesChance(800000); // 80% YES probability
// 800000 / 1000000 = 80%
```

### Scenario 5: Fast Dispute (Testing)
```solidity
oracle.setEscalationPeriod(2); // 2 epochs = 10 minutes (for fast tests)
// Or use Hardhat time manipulation: await time.increase(36 * 60 * 60); // Skip 36 hours
```

### Scenario 6: Already Finalized (Cannot Dispute)
```solidity
oracle.setStatus(true, MockOracle.VoteOption.Yes);
// openDispute() will revert
```

## Testing Checklist

- ✅ Deploy all mock contracts
- ✅ Connect oracle to market via factory
- ✅ Configure market TVL
- ✅ Set oracle status (not finalized)
- ✅ Mint collateral tokens
- ✅ Open dispute
- ✅ Send cross-chain vote
- ✅ Resolve dispute
- ✅ Claim rewards

