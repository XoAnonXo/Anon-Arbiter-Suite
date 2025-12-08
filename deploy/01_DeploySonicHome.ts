import assert from 'assert'
import { type DeployFunction } from 'hardhat-deploy/types'
import { ethers } from 'hardhat'

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Deploy DisputeResolverHome on Sonic Mainnet (Home Chain)
 * 
 * Deploys:
 * 1. MockERC20 - Collateral token (USDC with 6 decimals)
 * 2. MockAnonStaking - Mock staking NFT contract
 * 3. MockOracle - Oracle for disputes
 * 4. MockMarket - Market contract
 * 5. MockMarketFactory - Mock factory for home chain markets
 * 6. Vault - Vault for protocol fees
 * 7. DisputeResolverHome - Main dispute resolver with ERC721
 */
const deploy: DeployFunction = async (hre) => {
    const { getNamedAccounts, deployments } = hre
    const { deploy } = deployments
    const { deployer } = await getNamedAccounts()

    assert(deployer, 'Missing named deployer account')

    console.log(`\n========================================`)
    console.log(`Deploying to Sonic Mainnet (Home Chain)`)
    console.log(`Network: ${hre.network.name}`)
    console.log(`Deployer: ${deployer}`)
    console.log(`========================================\n`)

    // Get LayerZero EndpointV2
    const endpointV2Deployment = await hre.deployments.get('EndpointV2')
    console.log(`LayerZero EndpointV2: ${endpointV2Deployment.address}`)

    // 1. Deploy MockERC20 (USDC with 6 decimals)
    await sleep(5000)
    const mockERC20 = await deploy('MockERC20', {
        from: deployer,
        args: [
            'USD Coin Mock',  // name
            'USDC',           // symbol
            6,                // decimals
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockERC20 (USDC) deployed: ${mockERC20.address}\n`)

    // 2. Deploy MockAnonStaking
    await sleep(5000)
    const mockAnonStaking = await deploy('MockAnonStaking', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockAnonStaking deployed: ${mockAnonStaking.address}\n`)

    // 3. Deploy MockOracle
    await sleep(5000)
    const mockOracle = await deploy('MockOracle', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockOracle deployed: ${mockOracle.address}\n`)

    // 4. Deploy MockMarket
    await sleep(5000)
    const mockMarket = await deploy('MockMarket', {
        from: deployer,
        args: [mockERC20.address], // collateralToken
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockMarket deployed: ${mockMarket.address}\n`)

    // 5. Deploy MockMarketFactory (for home chain markets)
    await sleep(5000)
    const mockMarketFactory = await deploy('MockMarketFactory', {
        from: deployer,
        args: [],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ MockMarketFactory deployed: ${mockMarketFactory.address}\n`)

    // 6. Deploy Vault
    await sleep(5000)
    const vault = await deploy('Vault', {
        from: deployer,
        args: [deployer], // owner
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ Vault deployed: ${vault.address}\n`)

    // 7. Deploy DisputeResolverHome
    await sleep(5000)
    const disputeResolverHome = await deploy('DisputeResolverHome', {
        from: deployer,
        args: [
            endpointV2Deployment.address,     // _layerZeroEndpoint
            deployer,                          // _delegate
            mockAnonStaking.address,           // _AnonStaking
            mockMarketFactory.address,         // _marketFactory
            vault.address,                     // _vault
        ],
        log: true,
        skipIfAlreadyDeployed: false,
    })
    console.log(`✅ DisputeResolverHome deployed: ${disputeResolverHome.address}\n`)

    // 8. Approve DisputeResolverHome in Vault
    await sleep(5000)
    console.log(`Approving DisputeResolverHome in Vault...`)
    const vaultContract = await ethers.getContractAt('Vault', vault.address)
    const tx = await vaultContract.setApprovedResolver(disputeResolverHome.address, true)
    await tx.wait()
    console.log(`✅ DisputeResolverHome approved in Vault\n`)

    // 9. Setup - Link oracle to AMM market in factory
    await sleep(5000)
    console.log(`Setting up oracle -> AMM market link...`)
    const factory = await ethers.getContractAt('MockMarketFactory', mockMarketFactory.address)
    const tx2 = await factory.setAMMMarket(mockOracle.address, mockMarket.address)
    await tx2.wait()
    console.log(`✅ Oracle ${mockOracle.address} linked to AMM Market ${mockMarket.address}\n`)

    // 10. Configure MockOracle - set as not finalized with draft status
    await sleep(5000)
    console.log(`Configuring MockOracle...`)
    const oracle = await ethers.getContractAt('MockOracle', mockOracle.address)
    const tx3 = await oracle.setStatus(false, 1) // Not finalized, status = Yes
    await tx3.wait()
    console.log(`✅ Oracle configured: isFinalized=false, status=Yes\n`)

    // 11. Configure MockMarket - set TVL (1M USDC)
    await sleep(5000)
    console.log(`Configuring MockMarket...`)
    const market = await ethers.getContractAt('MockMarket', mockMarket.address)
    const tx4 = await market.setTVL(
        1_000_000 * 1e6             // collateralTvl = 1M USDC (6 decimals)
    )
    await tx4.wait()
    console.log(`✅ Market configured: TVL = 1M USDC\n`)

    // 12. Mint test USDC to deployer for testing
    await sleep(5000)
    console.log(`Minting test USDC...`)
    const usdc = await ethers.getContractAt('MockERC20', mockERC20.address)
    const tx5 = await usdc.mint(deployer, 10_000_000 * 1e6) // 10M USDC
    await tx5.wait()
    console.log(`✅ Minted 10M USDC to deployer\n`)

    // Summary
    console.log(`\n========================================`)
    console.log(`🎉 Sonic (Home Chain) Deployment Complete!`)
    console.log(`========================================`)
    console.log(`MockERC20 (USDC):        ${mockERC20.address}`)
    console.log(`MockAnonStaking:         ${mockAnonStaking.address}`)
    console.log(`MockOracle:              ${mockOracle.address}`)
    console.log(`MockMarket:              ${mockMarket.address}`)
    console.log(`MockMarketFactory:       ${mockMarketFactory.address}`)
    console.log(`Vault:                   ${vault.address}`)
    console.log(`DisputeResolverHome:     ${disputeResolverHome.address}`)
    console.log(`LayerZero Endpoint:      ${endpointV2Deployment.address}`)
    console.log(`========================================\n`)

    console.log(`📝 Configuration:`)
    console.log(`- Oracle -> Market linked in factory`)
    console.log(`- Oracle: not finalized, status=Yes (can dispute)`)
    console.log(`- Market: 1M USDC TVL`)
    console.log(`- Deployer: 10M USDC minted for testing`)
    console.log(`========================================\n`)
}

deploy.tags = ['SonicHome', 'Home']
deploy.skip = async (hre) => {
    // Only run on sonic_mainnet
    return hre.network.name !== 'sonic_mainnet'
}

export default deploy

// ========================================
// 🎉 Sonic (Home Chain) Deployment Complete!
// ========================================
// MockERC20 (USDC):        0x82F6A77b88324457AC69D83Df5C76E30825886A0
// MockAnonStaking:         0xDE3d4D62CCA3C506106e78FF74c560ED8d605C8B
// MockOracle:              0xF169523eFcD845bd8A008d39565ef26712D0c2D8
// MockMarket:              0xDD652Afe351bcCC1b315F710DcE9aB25E33D59a0
// MockMarketFactory:       0x31BAE9927929A6F2854d08Bd119fB7b2e12C03Ae
// Vault:                   0xFfe97cfE5fa7e97c3268faB005B235DD999a8812
// DisputeResolverHome:     0x282634e467b4c96057820D05F83981bfB8fEfCBD
// LayerZero Endpoint:      0x6F475642a6e85809B1c36Fa62763669b1b48DD5B
// ========================================