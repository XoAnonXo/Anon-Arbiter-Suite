import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Deploy DisputeResolverHome on Sonic Mainnet using EXISTING contracts
 * 
 * npx hardhat deploy --tags SonicExisting --network sonic_mainnet
 * 
 * Uses existing:
 * - USDC: 0xc6020e5492c2892fD63489797ce3d431ae101d5e
 * - AnonStaking: 0x780aE218A02A20b69aC3Da7Bf80c08A70A330a5e
 * - MarketFactory: 0x017277d36f80422a5d0aA5B8C93f5ae57BA2A317
 * - Oracle: 0x9492a0c32Fb22d1b8940e44C4D69f82B6C3cb298
 * 
 * Deploys:
 * 1. Vault - Protocol fee vault
 * 2. DisputeResolverHome - Main dispute resolver
 */
const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    // Existing Sonic contracts
    const EXISTING_USDC = '0xc6020e5492c2892fD63489797ce3d431ae101d5e'
    const EXISTING_MARKET_FACTORY = '0x017277d36f80422a5d0aA5B8C93f5ae57BA2A317'
    const EXISTING_ORACLE = '0x9492a0c32Fb22d1b8940e44C4D69f82B6C3cb298'
    const EXISTING_ANON_STAKING = '0x780aE218A02A20b69aC3Da7Bf80c08A70A330a5e'

    console.log(`\n========================================`)
    console.log(`Deploying to Sonic Mainnet (Home Chain)`)
    console.log(`Using EXISTING contracts`)
    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)
    console.log(`========================================\n`)

    console.log(`📋 Existing Contracts:`)
    console.log(`- USDC: ${EXISTING_USDC}`)
    console.log(`- AnonStaking: ${EXISTING_ANON_STAKING}`)
    console.log(`- MarketFactory: ${EXISTING_MARKET_FACTORY}`)
    console.log(`- Oracle: ${EXISTING_ORACLE}\n`)

    // Get LayerZero EndpointV2
    const endpointV2Deployment = await hre.deployments.get('EndpointV2')
    console.log(`LayerZero EndpointV2: ${endpointV2Deployment.address}`)

    // 1. Deploy Vault
    console.log(`📦 Deploying Vault...`)
    await sleep(3000)
    const vault = await deploy('Vault', {
        from: deployer,
        args: [deployer], // owner
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ Vault deployed: ${vault.address}\n`)

    // 2. Deploy DisputeResolverHome with EXISTING contracts
    console.log(`📦 Deploying DisputeResolverHome...`)
    await sleep(3000)
    const disputeResolverHome = await deploy('DisputeResolverHome', {
        from: deployer,
        args: [
            endpointV2Deployment.address,     // _layerZeroEndpoint
            deployer,                          // _delegate
            EXISTING_ANON_STAKING,             // _AnonStaking (EXISTING!)
            EXISTING_MARKET_FACTORY,           // _marketFactory (EXISTING!)
            vault.address,                     // _vault
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ DisputeResolverHome deployed: ${disputeResolverHome.address}\n`)

    // 3. Approve DisputeResolverHome in Vault
    console.log(`🔧 Approving DisputeResolverHome in Vault...`)
    await sleep(3000)
    const vaultContract = await ethers.getContractAt('Vault', vault.address)
    const tx = await vaultContract.setApprovedResolver(disputeResolverHome.address, true)
    await tx.wait()
    console.log(`✅ DisputeResolverHome approved in Vault\n`)

    // Summary
    console.log(`\n========================================`)
    console.log(`🎉 Sonic (Home Chain) Deployment Complete!`)
    console.log(`========================================`)
    console.log(`\n📋 EXISTING CONTRACTS (unchanged):`)
    console.log(`USDC:                    ${EXISTING_USDC}`)
    console.log(`AnonStaking:             ${EXISTING_ANON_STAKING}`)
    console.log(`MarketFactory:           ${EXISTING_MARKET_FACTORY}`)
    console.log(`Oracle:                  ${EXISTING_ORACLE}`)
    console.log(`\n📦 NEW CONTRACTS:`)
    console.log(`Vault:                   ${vault.address}`)
    console.log(`DisputeResolverHome:     ${disputeResolverHome.address}`)
    console.log(`\n🔗 LAYERZERO:`)
    console.log(`Endpoint:                ${endpointV2Deployment.address}`)
    console.log(`========================================\n`)

    console.log(`📝 Next Steps:`)
    console.log(`1. Deploy DisputeResolverRemote on Base (if cross-chain needed)`)
    console.log(`2. Configure LayerZero peers`)
    console.log(`3. Register markets using scripts/registerMarkets.ts`)
    console.log(`========================================\n`)
}

deploy.tags = ['SonicExisting', 'HomeExisting']
deploy.skip = async (hre) => {
    return hre.network.name !== 'sonic_mainnet'
}

export default deploy




