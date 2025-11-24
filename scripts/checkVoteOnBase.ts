import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'

/**
 * Check vote results on Base after cross-chain vote from Sonic
 * 
 * Usage:
 * npx hardhat run scripts/checkVoteOnBase.ts --network base
 */

// ⚠️ UPDATE THESE ADDRESSES
const BASE_ADDRESSES = {
    disputeResolverRemote: '0xdA0C272103179bC72EAc88885e11F859979B5e7E',
    mockOracle: '0xD656BE6eb3BAB1F06c6c85035c1714aB73EF2493',
}

async function main() {
    console.log(`\n========================================`)
    console.log(`Check Vote Results on Base`)
    console.log(`========================================\n`)

    // Ask user for tokenId
    const args = process.argv.slice(2)
    let TEST_TOKEN_ID = 2 // Default

    // Check if tokenId provided as argument
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--tokenId' && args[i + 1]) {
            TEST_TOKEN_ID = parseInt(args[i + 1])
            break
        }
    }

    console.log(`Checking votes for TokenId: ${TEST_TOKEN_ID}\n`)

    const resolver = await hre.ethers.getContractAt(
        'DisputeResolverRemote',
        BASE_ADDRESSES.disputeResolverRemote
    )

    // Get dispute info
    const disputeInfo = await resolver.getDisputeInfo(BASE_ADDRESSES.mockOracle)
    console.log(`Dispute Info:`)
    console.log(`  State: ${disputeInfo.state} (0=NotActive, 1=Active, 2=Resolved, 3=Failed)`)
    console.log(`  Disputer: ${disputeInfo.disputer}`)
    console.log(`  Draft Status: ${disputeInfo.draftStatus} (1=Yes, 2=No, 3=Unknown)`)
    console.log(`  End At: ${new Date(disputeInfo.endAt * 1000).toISOString()}`)
    console.log()

    // Get vote counts
    const yesVotes = await resolver.getVoteCount(BASE_ADDRESSES.mockOracle, 1)
    const noVotes = await resolver.getVoteCount(BASE_ADDRESSES.mockOracle, 2)
    const unknownVotes = await resolver.getVoteCount(BASE_ADDRESSES.mockOracle, 3)

    console.log(`Vote Counts:`)
    console.log(`  Yes:     ${hre.ethers.utils.formatUnits(yesVotes, 18)}`)
    console.log(`  No:      ${hre.ethers.utils.formatUnits(noVotes, 18)}`)
    console.log(`  Unknown: ${hre.ethers.utils.formatUnits(unknownVotes, 18)}`)
    console.log()

    // Check if tokenId voted
    const hasVoted = await resolver.hasVoted(BASE_ADDRESSES.mockOracle, TEST_TOKEN_ID)
    console.log(`Token #${TEST_TOKEN_ID} voted: ${hasVoted}`)

    if (hasVoted) {
        const voteRecord = await resolver.getVoteRecordInfo(BASE_ADDRESSES.mockOracle, TEST_TOKEN_ID)
        console.log(`  Power: ${hre.ethers.utils.formatUnits(voteRecord.power, 18)}`)
        console.log(`  Voted For: ${voteRecord.votedFor} (1=Yes, 2=No, 3=Unknown)`)
        console.log(`  Claimed: ${voteRecord.isClaimed}`)
    }

    console.log(`\n========================================\n`)

    if (hasVoted) {
        console.log(`✅ Cross-chain vote successful!`)
    } else {
        console.log(`⏳ Vote not yet received. LayerZero messages take ~1 minute.`)
        console.log(`Run this script again in a minute.`)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

