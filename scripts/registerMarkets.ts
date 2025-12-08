/**
 * Script to register markets in the MockMarketFactory
 * 
 * This populates the poll→market mapping so that DisputeResolverHome
 * can look up markets when opening disputes.
 * 
 * Usage:
 *   npx hardhat run scripts/registerMarkets.ts --network sonic_mainnet
 */

import { ethers } from "hardhat";

// Contract addresses on Sonic
const MARKET_FACTORY_REAL = "0x017277d36f80422a5d0aA5B8C93f5ae57BA2A317"; // Real factory with events
const DISPUTE_RESOLVER_HOME = "0x23a6f3ecD197D162D1075b054798809d9a71FcBd";

// Event signatures for MarketCreated events
const AMM_MARKET_CREATED_EVENT_SIG = "0xf5b2abb382b9f0eb4f933cd3f370115f4954022578022da4cd1e409828273b7c";
const PARI_MARKET_CREATED_EVENT_SIG = "0x836dd531f538df807bcf0fef473f25364dbaf59f39be038e49939f6087533b05";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Running with account:", deployer.address);

  // Get DisputeResolverHome to find its marketFactory address
  const disputeResolver = await ethers.getContractAt(
    ["function marketFactory() view returns (address)"],
    DISPUTE_RESOLVER_HOME
  );
  
  const mockFactoryAddress = await disputeResolver.marketFactory();
  console.log("DisputeResolverHome.marketFactory:", mockFactoryAddress);

  // Get MockMarketFactory
  const mockFactory = await ethers.getContractAt(
    [
      "function setAMMMarket(address oracle, address market) external",
      "function setPariMutuelMarket(address oracle, address market) external",
      "function getMarketByPoll(address oracle) view returns (address)",
      "function getPariMutuelByPoll(address oracle) view returns (address)",
      "function owner() view returns (address)"
    ],
    mockFactoryAddress
  );

  const factoryOwner = await mockFactory.owner();
  console.log("MockMarketFactory owner:", factoryOwner);
  
  if (factoryOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("ERROR: You are not the owner of MockMarketFactory!");
    console.error("Owner:", factoryOwner);
    console.error("Your address:", deployer.address);
    return;
  }

  const provider = ethers.provider;

  // Fetch AMM MarketCreated events
  console.log("\nFetching AMM MarketCreated events from real factory...");
  const ammLogs = await provider.getLogs({
    address: MARKET_FACTORY_REAL,
    topics: [AMM_MARKET_CREATED_EVENT_SIG],
    fromBlock: 0,
    toBlock: "latest",
  });
  console.log(`Found ${ammLogs.length} AMM market events`);

  // Fetch PariMutuel MarketCreated events
  console.log("Fetching PariMutuel MarketCreated events from real factory...");
  const pariLogs = await provider.getLogs({
    address: MARKET_FACTORY_REAL,
    topics: [PARI_MARKET_CREATED_EVENT_SIG],
    fromBlock: 0,
    toBlock: "latest",
  });
  console.log(`Found ${pariLogs.length} PariMutuel market events`);

  // Extract AMM markets
  const ammMarkets = ammLogs.map(log => ({
    pollAddress: ethers.utils.getAddress("0x" + log.topics[1].slice(26)),
    marketAddress: ethers.utils.getAddress("0x" + log.topics[2].slice(26)),
    type: 'amm' as const
  }));

  // Extract PariMutuel markets
  const pariMarkets = pariLogs.map(log => ({
    pollAddress: ethers.utils.getAddress("0x" + log.topics[1].slice(26)),
    marketAddress: ethers.utils.getAddress("0x" + log.topics[2].slice(26)),
    type: 'pari' as const
  }));

  // Check which AMM markets need to be registered
  console.log("\nChecking which AMM markets need registration...");
  const ammToRegister: typeof ammMarkets = [];
  for (const market of ammMarkets) {
    const existing = await mockFactory.getMarketByPoll(market.pollAddress);
    if (existing === ethers.constants.AddressZero) {
      ammToRegister.push(market);
      console.log(`  Need to register: ${market.pollAddress} → ${market.marketAddress}`);
    } else {
      console.log(`  Already registered: ${market.pollAddress}`);
    }
  }

  // Check which PariMutuel markets need to be registered
  console.log("\nChecking which PariMutuel markets need registration...");
  const pariToRegister: typeof pariMarkets = [];
  for (const market of pariMarkets) {
    const existing = await mockFactory.getPariMutuelByPoll(market.pollAddress);
    if (existing === ethers.constants.AddressZero) {
      pariToRegister.push(market);
      console.log(`  Need to register: ${market.pollAddress} → ${market.marketAddress}`);
    } else {
      console.log(`  Already registered: ${market.pollAddress}`);
    }
  }

  const totalToRegister = ammToRegister.length + pariToRegister.length;
  if (totalToRegister === 0) {
    console.log("\nAll markets are already registered!");
    return;
  }

  // Register AMM markets
  if (ammToRegister.length > 0) {
    console.log(`\nRegistering ${ammToRegister.length} AMM markets...`);
    for (const { pollAddress, marketAddress } of ammToRegister) {
      console.log(`  Registering AMM: ${pollAddress} → ${marketAddress}...`);
      const tx = await mockFactory.setAMMMarket(pollAddress, marketAddress);
      await tx.wait();
      console.log(`    Done (tx: ${tx.hash})`);
    }
  }

  // Register PariMutuel markets
  if (pariToRegister.length > 0) {
    console.log(`\nRegistering ${pariToRegister.length} PariMutuel markets...`);
    for (const { pollAddress, marketAddress } of pariToRegister) {
      console.log(`  Registering Pari: ${pollAddress} → ${marketAddress}...`);
      const tx = await mockFactory.setPariMutuelMarket(pollAddress, marketAddress);
      await tx.wait();
      console.log(`    Done (tx: ${tx.hash})`);
    }
  }

  console.log("\n✅ All markets registered successfully!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


