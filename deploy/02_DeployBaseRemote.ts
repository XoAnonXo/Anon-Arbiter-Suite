import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Deploy DisputeResolverRemote on Base Mainnet (Remote Chain)
 * 
 * Deploys:
 * 1. MockERC20 - Collateral token (USDC with 18 decimals)
 * 2. MockOracle - Oracle for disputes
 * 3. MockMarket - Market contract
 * 4. MockMarketFactory - Factory linking oracles to markets
 * 5. Vault - Vault for protocol fees
 * 6. DisputeResolverRemote - Remote dispute resolver
 */
const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`\n========================================`)
    console.log(`Deploying to Base Mainnet (Remote Chain)`)
    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)
    console.log(`========================================\n`)

    // Get LayerZero EndpointV2
    const endpointV2Deployment = await hre.deployments.get('EndpointV2')
    console.log(`LayerZero EndpointV2: ${endpointV2Deployment.address}`)

    // Sonic Mainnet EID (home chain)
    const SONIC_MAINNET_EID = 30332

    // 1. Deploy MockERC20 (USDC with 18 decimals)
    await sleep(5000)
    const mockERC20 = await deploy('MockERC20', {
        from: deployer,
        args: [
            'USD Coin Mock',  // name
            'USDC',           // symbol
            18,               // decimals (pretend 18 for Base)
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockERC20 (USDC) deployed: ${mockERC20.address}\n`)

    // 2. Deploy MockOracle
    await sleep(5000)
    const mockOracle = await deploy('MockOracle', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockOracle deployed: ${mockOracle.address}\n`)

    // 3. Deploy MockMarket
    await sleep(5000)
    const mockMarket = await deploy('MockMarket', {
        from: deployer,
        args: [mockERC20.address], // collateralToken
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockMarket deployed: ${mockMarket.address}\n`)

    // 4. Deploy MockMarketFactory
    await sleep(5000)
    const mockMarketFactory = await deploy('MockMarketFactory', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockMarketFactory deployed: ${mockMarketFactory.address}\n`)

    // 5. Deploy Vault
    await sleep(5000)
    const vault = await deploy('Vault', {
        from: deployer,
        args: [deployer], // owner
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ Vault deployed: ${vault.address}\n`)

    // 6. Deploy DisputeResolverRemote
    await sleep(5000)
    const disputeResolverRemote = await deploy('DisputeResolverRemote', {
        from: deployer,
        args: [
            endpointV2Deployment.address,     // _layerZeroEndpoint
            deployer,                          // _delegate
            SONIC_MAINNET_EID,                 // _homeChainEid (Sonic)
            mockMarketFactory.address,         // _marketFactory
            vault.address,                     // _vault
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ DisputeResolverRemote deployed: ${disputeResolverRemote.address}\n`)

    // 7. Approve DisputeResolverRemote in Vault
    await sleep(5000)
    console.log(`Approving DisputeResolverRemote in Vault...`)
    const vaultContract = await ethers.getContractAt('Vault', vault.address)
    const txVault = await vaultContract.setApprovedResolver(disputeResolverRemote.address, true)
    await txVault.wait()
    console.log(`✅ DisputeResolverRemote approved in Vault\n`)

    // 8. Setup - Link oracle to AMM market in factory
    await sleep(5000)
    console.log(`Setting up oracle -> AMM market link...`)
    const factory = await ethers.getContractAt('MockMarketFactory', mockMarketFactory.address)
    const tx = await factory.setAMMMarket(mockOracle.address, mockMarket.address)
    await tx.wait()
    console.log(`✅ Oracle ${mockOracle.address} linked to AMM Market ${mockMarket.address}\n`)

    // 9. Configure MockOracle - set as not finalized with draft status
    await sleep(5000)
    console.log(`Configuring MockOracle...`)
    const oracle = await ethers.getContractAt('MockOracle', mockOracle.address)
    const tx2 = await oracle.setStatus(false, 1) // Not finalized, status = Yes
    await tx2.wait()
    console.log(`✅ Oracle configured: isFinalized=false, status=Yes\n`)

    // 10. Configure MockMarket - set TVL (1M USDC)
    await sleep(5000)
    console.log(`Configuring MockMarket...`)
    const market = await ethers.getContractAt('MockMarket', mockMarket.address)
    const tx3 = await market.setTVL(
        ethers.utils.parseUnits('1000000', 18) // collateralTvl = 1M USDC (18 decimals)
    )
    await tx3.wait()
    console.log(`✅ Market configured: TVL = 1M USDC\n`)

    // 11. Mint test USDC to deployer for testing
    await sleep(5000)
    console.log(`Minting test USDC...`)
    const usdc = await ethers.getContractAt('MockERC20', mockERC20.address)
    const tx4 = await usdc.mint(deployer, ethers.utils.parseUnits('10000000', 18)) // 10M USDC (18 decimals)
    await tx4.wait()
    console.log(`✅ Minted 10M USDC to deployer\n`)

    // Summary
    console.log(`\n========================================`)
    console.log(`🎉 Base (Remote Chain) Deployment Complete!`)
    console.log(`========================================`)
    console.log(`MockERC20 (USDC):        ${mockERC20.address}`)
    console.log(`MockOracle:              ${mockOracle.address}`)
    console.log(`MockMarket:              ${mockMarket.address}`)
    console.log(`MockMarketFactory:       ${mockMarketFactory.address}`)
    console.log(`Vault:                   ${vault.address}`)
    console.log(`DisputeResolverRemote:   ${disputeResolverRemote.address}`)
    console.log(`LayerZero Endpoint:      ${endpointV2Deployment.address}`)
    console.log(`Home Chain EID (Sonic):  ${SONIC_MAINNET_EID}`)
    console.log(`========================================\n`)

    console.log(`📝 Configuration:`)
    console.log(`- Oracle -> Market linked in factory`)
    console.log(`- Oracle: not finalized, status=Yes (can dispute)`)
    console.log(`- Market: 1M USDC TVL`)
    console.log(`- Deployer: 10M USDC minted for testing`)
    console.log(`========================================\n`)
}

deploy.tags = ['BaseRemote', 'Remote']
deploy.skip = async (hre) => {
    // Only run on base mainnet
    return hre.network.name !== 'base'
}

export default deploy


// ========================================
// 🎉 Base (Remote Chain) Deployment Complete!
// ========================================
// MockERC20 (USDC):        0x274aDA3d47A76bF1cEC0Ba07Bc74C053315b20B0
// MockOracle:              0xD656BE6eb3BAB1F06c6c85035c1714aB73EF2493
// MockMarket:              0xeD673674c87d1f40E6490338c5f2Bd0078766ED7
// MockMarketFactory:       0xEc679E883E8b7340bc6dB97BeFf1a1bc3212da7D
// Vault:                   0x7EAc7789aa3C9cc44E9BA3aB50463A5b1A9F18c4
// DisputeResolverRemote:   0xdA0C272103179bC72EAc88885e11F859979B5e7E
// LayerZero Endpoint:      0x1a44076050125825900e736c501f859c50fE728c
// Home Chain EID (Sonic):  30332
// ========================================

// 📝 Configuration:
// - Oracle -> Market linked in factory
// - Oracle: not finalized, status=Yes (can dispute)
// - Market: 1M USDC TVL
// - Deployer: 10M USDC minted for testing
// ========================================