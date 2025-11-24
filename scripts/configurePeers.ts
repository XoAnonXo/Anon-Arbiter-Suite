import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'

//npx hardhat lz:oapp:config:set --oapp-config layerzero.dispute.config.ts --network sonic_mainnet
/**
 * Configure LayerZero peers after deployment
 * 
 * Must be run AFTER deploying to BOTH chains
 * 
 * Usage:
 * 1. Update addresses below with actual deployment addresses
 * 2. Run on home chain: npx hardhat run scripts/configurePeers.ts --network sonic_mainnet
 * 3. Run on remote chain: npx hardhat run scripts/configurePeers.ts --network base
 */
async function main() {
    const networkName = hre.network.name

    // ⚠️ UPDATE THESE ADDRESSES AFTER DEPLOYMENT
    const DISPUTE_RESOLVER_HOME_ADDRESS = '0x...' // DisputeResolverHome on Sonic
    const DISPUTE_RESOLVER_REMOTE_ADDRESS = '0x...' // DisputeResolverRemote on Base

    const SONIC_EID = 30332
    const BASE_EID = 30184

    console.log(`\n========================================`)
    console.log(`Configuring LayerZero Peers`)
    console.log(`Network: ${networkName}`)
    console.log(`========================================\n`)

    if (networkName === 'sonic_mainnet') {
        // Configure on Sonic: set Base as peer
        console.log(`Setting Base (${BASE_EID}) as peer...`)
        const disputeResolverHome = await hre.ethers.getContractAt(
            'DisputeResolverHome',
            DISPUTE_RESOLVER_HOME_ADDRESS
        )

        // Convert remote address to bytes32
        const peerBytes32 = hre.ethers.utils.zeroPad(DISPUTE_RESOLVER_REMOTE_ADDRESS, 32)

        const tx = await disputeResolverHome.setPeer(BASE_EID, peerBytes32)
        await tx.wait()

        console.log(`✅ Peer set: Base EID ${BASE_EID} -> ${DISPUTE_RESOLVER_REMOTE_ADDRESS}`)
    } else if (networkName === 'base') {
        // Configure on Base: set Sonic as peer
        console.log(`Setting Sonic (${SONIC_EID}) as peer...`)
        const disputeResolverRemote = await hre.ethers.getContractAt(
            'DisputeResolverRemote',
            DISPUTE_RESOLVER_REMOTE_ADDRESS
        )

        // Convert home address to bytes32
        const peerBytes32 = hre.ethers.utils.zeroPad(DISPUTE_RESOLVER_HOME_ADDRESS, 32)

        const tx = await disputeResolverRemote.setPeer(SONIC_EID, peerBytes32)
        await tx.wait()

        console.log(`✅ Peer set: Sonic EID ${SONIC_EID} -> ${DISPUTE_RESOLVER_HOME_ADDRESS}`)
    } else {
        console.error(`❌ Unknown network: ${networkName}`)
        console.error(`Must be 'sonic_mainnet' or 'base'`)
        process.exit(1)
    }

    console.log(`\n========================================`)
    console.log(`✅ Peer configuration complete!`)
    console.log(`========================================\n`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

