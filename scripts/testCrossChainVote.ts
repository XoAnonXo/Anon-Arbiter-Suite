import hre from 'hardhat'
import '@nomiclabs/hardhat-ethers'

/**
 * Test Cross-Chain Voting Flow
 * 
 * Flow:
 * 1. Open dispute on Base (remote chain)
 * 2. Wrap NFT on Sonic (home chain)
 * 3. Vote from Sonic on Base dispute
 * 4. Verify vote recorded on Base
 * 
 * Prerequisites:
 * - Both chains deployed
 * - Peers configured
 * - Update addresses below
 */

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const SLEEP_TIME = 3000 // 3 seconds between transactions

// ⚠️ UPDATE THESE ADDRESSES
const SONIC_ADDRESSES = {
    disputeResolverHome: '0x282634e467b4c96057820D05F83981bfB8fEfCBD',
    mockAnonStaking: '0xDE3d4D62CCA3C506106e78FF74c560ED8d605C8B',
    mockERC20: '0x82F6A77b88324457AC69D83Df5C76E30825886A0',
}

const BASE_ADDRESSES = {
    disputeResolverRemote: '0xdA0C272103179bC72EAc88885e11F859979B5e7E',
    mockOracle: '0xD656BE6eb3BAB1F06c6c85035c1714aB73EF2493',
    mockERC20: '0x274aDA3d47A76bF1cEC0Ba07Bc74C053315b20B0',
}

const BASE_EID = 30184

async function main() {
    const [signer] = await hre.ethers.getSigners()
    console.log(`Testing with account: ${signer.address}\n`)

    const networkName = hre.network.name

    if (networkName === 'base') {
        await openDisputeOnBase(signer)
    } else if (networkName === 'sonic_mainnet') {
        await voteFromSonic(signer)
    } else {
        console.error(`❌ Unknown network: ${networkName}`)
        process.exit(1)
    }
}

async function openDisputeOnBase(signer: any) {
    console.log(`\n========================================`)
    console.log(`Step 1: Open Dispute on Base`)
    console.log(`========================================\n`)

    const usdc = await hre.ethers.getContractAt('MockERC20', BASE_ADDRESSES.mockERC20)
    const resolver = await hre.ethers.getContractAt('DisputeResolverRemote', BASE_ADDRESSES.disputeResolverRemote)

    // Check if dispute already exists
    const disputeInfo = await resolver.getDisputeInfo(BASE_ADDRESSES.mockOracle)
    if (disputeInfo.state !== 0) {
        console.log(`⚠️ Dispute already exists! State: ${disputeInfo.state}`)
        return
    }

    // Calculate required collateral (1% of TVL, min 1e6)
    const collateralRequired = hre.ethers.utils.parseUnits('10000', 18) // 10k USDC

    console.log(`Required collateral: 10,000 USDC`)

    // Check balance
    const balance = await usdc.balanceOf(signer.address)
    console.log(`Your USDC balance: ${hre.ethers.utils.formatUnits(balance, 18)}`)

    if (balance.lt(collateralRequired)) {
        console.log(`\n❌ Insufficient USDC. Minting...`)
        const tx = await usdc.mint(signer.address, collateralRequired)
        await tx.wait()
        console.log(`✅ Minted 10,000 USDC\n`)
        await sleep(SLEEP_TIME)
    }

    // Approve collateral
    console.log(`Approving USDC...`)
    const approveTx = await usdc.approve(resolver.address, collateralRequired)
    await approveTx.wait()
    console.log(`✅ Approved\n`)
    await sleep(SLEEP_TIME)

    // Open dispute
    console.log(`Opening dispute...`)
    const openTx = await resolver.openDispute(
        BASE_ADDRESSES.mockOracle,
        2, // VoteOption.No
        'Market manipulation detected - cross-chain test'
    )
    await openTx.wait()
    console.log(`✅ Dispute opened!\n`)

    await sleep(SLEEP_TIME)
    const info = await resolver.getDisputeInfo(BASE_ADDRESSES.mockOracle)
    console.log(`Dispute Info:`)
    console.log(`  State: ${info.state} (1=Active)`)
    console.log(`  Disputer: ${info.disputer}`)
    console.log(`  Draft Status: ${info.draftStatus} (2=No)`)
    console.log(`  End At: ${new Date(info.endAt * 1000).toISOString()}`)
    console.log(`\n✅ Ready for voting! Now run on Sonic to vote.`)
}

async function voteFromSonic(signer: any) {
    console.log(`\n========================================`)
    console.log(`Step 2: Vote from Sonic on Base Dispute`)
    console.log(`========================================\n`)

    const anonStaking = await hre.ethers.getContractAt('MockAnonStaking', SONIC_ADDRESSES.mockAnonStaking)
    const resolver = await hre.ethers.getContractAt('DisputeResolverHome', SONIC_ADDRESSES.disputeResolverHome)

    // Set voteCooldown to 1 minute for testing
    console.log(`Setting voteCooldown to 1 minute (60 seconds) for testing...`)
    const setVoteCooldownTx = await resolver.setVoteCooldown(60)
    await setVoteCooldownTx.wait()
    console.log(`✅ Vote cooldown set to 1 minute\n`)
    await sleep(SLEEP_TIME)

    // Get next tokenId from totalSupply
    await sleep(SLEEP_TIME)
    // const totalSupply = await anonStaking.totalSupply()
    // const TEST_TOKEN_ID = totalSupply.toNumber() + 1
    const TEST_TOKEN_ID = 2
    // console.log(`Current totalSupply: ${totalSupply}`)
    console.log(`Minting next TokenId: ${TEST_TOKEN_ID}\n`)

    // Mint NFT in AnonStaking
    console.log(`Minting NFT #${TEST_TOKEN_ID} in AnonStaking...`)
    const mintTx = await anonStaking.mint(signer.address, TEST_TOKEN_ID)
    await mintTx.wait()
    console.log(`✅ Minted NFT #${TEST_TOKEN_ID}`)
    await sleep(SLEEP_TIME)

    // Set position data (1000 tokens, pool 2, locked 365 days)
    const lockedUntil = Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60)
    const lastPaidDay = Math.floor(Date.now() / 1000 / 86400)

    const setPosTx = await anonStaking.setPosition(
        TEST_TOKEN_ID,
        hre.ethers.utils.parseUnits('1000', 18), // 1000 tokens power
        2, // Pool 2 (365 days)
        lockedUntil,
        lastPaidDay
    )
    await setPosTx.wait()
    console.log(`✅ Position set (1000 tokens, pool 2)`)
    await sleep(SLEEP_TIME)

    // Wrap NFT in DisputeResolverHome
    console.log(`Wrapping NFT #${TEST_TOKEN_ID}...`)
    const approveTx = await anonStaking.approve(resolver.address, TEST_TOKEN_ID)
    await approveTx.wait()
    await sleep(SLEEP_TIME)

    const depositTx = await resolver.depositFor(signer.address, [TEST_TOKEN_ID])
    await depositTx.wait()
    console.log(`✅ NFT wrapped! Cooldown starts now.\n`)
    await sleep(SLEEP_TIME)

    // Quote LayerZero fee
    await sleep(SLEEP_TIME)
    console.log(`Quoting LayerZero fee for cross-chain vote...`)
    const options = '0x' // Empty options, use default
    const fee = await resolver.quoteVoteOnRemoteDispute(
        BASE_EID,
        BASE_ADDRESSES.mockOracle,
        2, // VoteOption.No
        [TEST_TOKEN_ID],
        options,
        false
    )
    console.log(`LayerZero fee: ${hre.ethers.utils.formatEther(fee.nativeFee)} native tokens\n`)

    // Test 1: Try to vote immediately (should FAIL due to cooldown)
    await sleep(SLEEP_TIME)
    console.log(`\n📝 Test 1: Attempting to vote immediately (should fail)...`)
    try {
        const voteTx1 = await resolver.voteOnRemoteDispute(
            BASE_EID,
            BASE_ADDRESSES.mockOracle,
            2, // VoteOption.No
            [TEST_TOKEN_ID],
            options,
            { value: fee.nativeFee }
        )
        await voteTx1.wait()
        console.log(`❌ UNEXPECTED: Vote succeeded when it should have failed!`)
    } catch (error: any) {
        if (error.message.includes('NFTLockedVotingCooldown') || error.data === '0x62db2fc1') {
            console.log(`✅ EXPECTED ERROR: Vote blocked by cooldown (NFTLockedVotingCooldown)`)
        } else {
            console.log(`❌ UNEXPECTED ERROR: ${error.message}`)
            throw error
        }
    }

    // Wait for cooldown to pass
    console.log(`\n⏳ Waiting 60 seconds (1 minute) for cooldown to pass...`)
    await sleep(60000)
    console.log(`✅ Cooldown period passed\n`)

    // Test 2: Try to vote after cooldown (should SUCCEED)
    await sleep(SLEEP_TIME)
    console.log(`📝 Test 2: Attempting to vote after cooldown (should succeed)...`)
    const voteTx = await resolver.voteOnRemoteDispute(
        BASE_EID,
        BASE_ADDRESSES.mockOracle,
        2, // VoteOption.No
        [TEST_TOKEN_ID],
        options,
        { value: fee.nativeFee }
    )
    const receipt = await voteTx.wait()
    console.log(`✅ EXPECTED SUCCESS: Vote sent! TX: ${receipt.transactionHash}`)

    console.log(`\n⏳ Wait ~1 minute for LayerZero to relay the message...`)
    console.log(`Then check vote on Base with:`)
    console.log(`npx hardhat run scripts/checkVoteOnBase.ts --network base --tokenId ${TEST_TOKEN_ID}\n`)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })

