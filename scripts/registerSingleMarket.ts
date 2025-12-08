/**
 * Script to register a single market in the MockMarketFactory
 * 
 * Usage:
 *   POLL=0x... MARKET=0x... npx hardhat run scripts/registerSingleMarket.ts --network sonic_mainnet
 */

import { ethers } from "hardhat";

const DISPUTE_RESOLVER_HOME = "0x8008AaF57ca73475209634b7528e8b5B886Ecf67";

async function main() {
  const pollAddress = process.env.POLL;
  const marketAddress = process.env.MARKET;

  if (!pollAddress || !marketAddress) {
    console.error("Usage: POLL=0x... MARKET=0x... npx hardhat run scripts/registerSingleMarket.ts --network sonic_mainnet");
    return;
  }

  const [deployer] = await ethers.getSigners();
  console.log("Running with account:", deployer.address);

  // Get DisputeResolverHome to find its marketFactory address
  const disputeResolver = await ethers.getContractAt(
    ["function marketFactory() view returns (address)"],
    DISPUTE_RESOLVER_HOME
  );
  
  const mockFactoryAddress = await disputeResolver.marketFactory();
  console.log("MockMarketFactory address:", mockFactoryAddress);

  // Get MockMarketFactory
  const mockFactory = await ethers.getContractAt(
    [
      "function setMarket(address oracle, address market) external",
      "function getMarketByPoll(address oracle) view returns (address)"
    ],
    mockFactoryAddress
  );

  // Check current mapping
  const existing = await mockFactory.getMarketByPoll(pollAddress);
  console.log("Current mapping:", existing);

  if (existing !== ethers.constants.AddressZero) {
    console.log("Market already registered!");
    return;
  }

  // Register market
  console.log(`Registering ${pollAddress} → ${marketAddress}...`);
  const tx = await mockFactory.setMarket(pollAddress, marketAddress);
  console.log("Tx submitted:", tx.hash);
  await tx.wait();
  console.log("✅ Market registered successfully!");

  // Verify
  const newMapping = await mockFactory.getMarketByPoll(pollAddress);
  console.log("New mapping:", newMapping);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


