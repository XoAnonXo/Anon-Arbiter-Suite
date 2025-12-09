import { ethers } from 'hardhat'

/**
 * 
 * npx hardhat run scripts/setCooldowns.ts --network sonic_mainnet
 * 
 * Set voteCooldown and unwrapCooldown to 2 minutes (120 seconds)
 * for frontend testing purposes
 */
async function main() {
    const DISPUTE_RESOLVER_HOME = '0x3F4Eca74CB96F81a001C25e88b2C1b219647D8DB'
    const NEW_COOLDOWN = 120 // 2 minutes in seconds

    console.log(`\n========================================`)
    console.log(`Setting Cooldowns for Frontend Testing`)
    console.log(`========================================\n`)
    console.log(`Contract: ${DISPUTE_RESOLVER_HOME}`)
    console.log(`New cooldown value: ${NEW_COOLDOWN} seconds (2 minutes)\n`)

    const [signer] = await ethers.getSigners()
    console.log(`Signer: ${signer.address}\n`)

    const disputeResolver = await ethers.getContractAt(
        'DisputeResolverHome',
        DISPUTE_RESOLVER_HOME,
        signer
    )

    // Check current values
    const currentVoteCooldown = await disputeResolver.voteCooldown()
    const currentUnwrapCooldown = await disputeResolver.unwrapCooldown()

    console.log(`Current voteCooldown: ${currentVoteCooldown} seconds (${Number(currentVoteCooldown) / 3600} hours)`)
    console.log(`Current unwrapCooldown: ${currentUnwrapCooldown} seconds (${Number(currentUnwrapCooldown) / 3600} hours)\n`)

    // Set voteCooldown
    console.log(`📝 Setting voteCooldown to ${NEW_COOLDOWN} seconds...`)
    const tx1 = await disputeResolver.setVoteCooldown(NEW_COOLDOWN)
    await tx1.wait()
    console.log(`✅ voteCooldown set! TX: ${tx1.hash}\n`)

    // Set unwrapCooldown
    console.log(`📝 Setting unwrapCooldown to ${NEW_COOLDOWN} seconds...`)
    const tx2 = await disputeResolver.setUnwrapCooldown(NEW_COOLDOWN)
    await tx2.wait()
    console.log(`✅ unwrapCooldown set! TX: ${tx2.hash}\n`)

    // Verify new values
    const newVoteCooldown = await disputeResolver.voteCooldown()
    const newUnwrapCooldown = await disputeResolver.unwrapCooldown()

    console.log(`========================================`)
    console.log(`✅ Cooldowns Updated Successfully!`)
    console.log(`========================================`)
    console.log(`New voteCooldown: ${newVoteCooldown} seconds (${Number(newVoteCooldown) / 60} minutes)`)
    console.log(`New unwrapCooldown: ${newUnwrapCooldown} seconds (${Number(newUnwrapCooldown) / 60} minutes)`)
    console.log(`========================================\n`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

