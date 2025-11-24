import hre from 'hardhat'
import 'hardhat-deploy'

/**
 * Show all deployed contract addresses
 * 
 * Usage:
 * npx hardhat run scripts/showDeployments.ts --network sonic_mainnet
 * npx hardhat run scripts/showDeployments.ts --network base
 */
async function main() {
    const { deployments } = hre as any
    const networkName = hre.network.name
    console.log(`\n========================================`)
    console.log(`Deployed Contracts on: ${networkName}`)
    console.log(`========================================\n`)

    const contracts = [
        'DisputeResolverHome',
        'DisputeResolverRemote',
        'MockAnonStaking',
        'MockMarketFactory',
        'MockOracle',
        'MockMarket',
        'MockERC20',
        'Vault',
    ]

    for (const contractName of contracts) {
        try {
            const deployment = await deployments.get(contractName)
            console.log(`${contractName.padEnd(25)} ${deployment.address}`)
        } catch (e) {
            // Contract not deployed on this network
            console.log(`${contractName.padEnd(25)} Not deployed`)
        }
    }

    // Show LayerZero Endpoint
    try {
        const endpoint = await deployments.get('EndpointV2')
        console.log(`\nLayerZero EndpointV2:     ${endpoint.address}`)
    } catch (e) {
        console.log(`\nLayerZero EndpointV2:     Not found`)
    }

    console.log(`\n========================================\n`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

