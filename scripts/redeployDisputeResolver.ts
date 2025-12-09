import { ethers } from 'hardhat'

/**
 * Redeploy only DisputeResolverHome with the REAL MarketFactory
 * 
 * Reuses existing:
 * - MockAnonStaking: 0xE8A6E80cF2C0846546F236c8680cbF289510708B
 * - Vault: 0x98c8b7F21aa1Ccd522cB9692fCe97F117735a06C
 * - LayerZero Endpoint: from deployments
 * 
 * Uses REAL MarketFactory: 0x017277d36f80422a5d0aA5B8C93f5ae57BA2A317
 */
async function main() {
    const [deployer] = await ethers.getSigners()
    
    // Existing contracts to reuse
    const ANON_STAKING = '0xE8A6E80cF2C0846546F236c8680cbF289510708B'
    const VAULT = '0x98c8b7F21aa1Ccd522cB9692fCe97F117735a06C'
    const MARKET_FACTORY = '0x017277d36f80422a5d0aA5B8C93f5ae57BA2A317' // REAL factory!
    const LZ_ENDPOINT = '0x6F475642a6e85809B1c36Fa62763669b1b48DD5B' // Sonic mainnet LZ endpoint

    console.log(`\n========================================`)
    console.log(`Redeploying DisputeResolverHome`)
    console.log(`========================================`)
    console.log(`Deployer: ${deployer.address}`)
    console.log(`\nUsing existing contracts:`)
    console.log(`- AnonStaking: ${ANON_STAKING}`)
    console.log(`- Vault: ${VAULT}`)
    console.log(`- MarketFactory: ${MARKET_FACTORY} (REAL!)`)
    console.log(`- LZ Endpoint: ${LZ_ENDPOINT}`)
    console.log(`========================================\n`)

    // Deploy DisputeResolverHome
    console.log(`📦 Deploying DisputeResolverHome...`)
    const DisputeResolverHome = await ethers.getContractFactory('DisputeResolverHome')
    const disputeResolver = await DisputeResolverHome.deploy(
        LZ_ENDPOINT,      // _layerZeroEndpoint
        deployer.address, // _delegate
        ANON_STAKING,     // _AnonStaking
        MARKET_FACTORY,   // _marketFactory (REAL!)
        VAULT             // _vault
    )
    await disputeResolver.deployed()
    console.log(`✅ DisputeResolverHome deployed: ${disputeResolver.address}\n`)

    // Verify the marketFactory is correct
    const factory = await disputeResolver.marketFactory()
    console.log(`✅ Verified marketFactory: ${factory}`)

    // Approve in Vault
    console.log(`\n🔧 Approving DisputeResolverHome in Vault...`)
    const vault = await ethers.getContractAt('Vault', VAULT)
    const tx = await vault.setApprovedResolver(disputeResolver.address, true)
    await tx.wait()
    console.log(`✅ DisputeResolverHome approved in Vault`)

    // Summary
    console.log(`\n========================================`)
    console.log(`🎉 Deployment Complete!`)
    console.log(`========================================`)
    console.log(`DisputeResolverHome: ${disputeResolver.address}`)
    console.log(`MarketFactory:       ${factory}`)
    console.log(`========================================`)
    console.log(`\n📝 Update frontend/src/config/contracts.ts:`)
    console.log(`DISPUTE_RESOLVER_HOME: '${disputeResolver.address}'`)
    console.log(`========================================\n`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })








