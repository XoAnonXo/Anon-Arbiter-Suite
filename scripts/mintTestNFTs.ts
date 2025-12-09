import { ethers } from 'hardhat';

async function main() {
    const TEST_WALLET = '0xf6596c0BB7CDfA407dAeda2ee436C8DF1709d33a';
    const ANON_STAKING = '0xCd7B94Ae42Fbf02E2Abd08db948289d6aB990Ffd';

    console.log(`\n========================================`);
    console.log(`Minting Test NFTs to ${TEST_WALLET}`);
    console.log(`========================================\n`);

    const [deployer] = await ethers.getSigners();
    console.log(`Deployer: ${deployer.address}`);

    const anonStaking = await ethers.getContractAt('MockAnonStaking', ANON_STAKING);

    // Mint 3 NFTs with different power levels
    const nfts = [
        { tokenId: 1001, amount: ethers.utils.parseEther('1000') },   // 1000 power
        { tokenId: 1002, amount: ethers.utils.parseEther('5000') },   // 5000 power
        { tokenId: 1003, amount: ethers.utils.parseEther('10000') },  // 10000 power
    ];

    const oneYearFromNow = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
    const currentDay = Math.floor(Date.now() / 1000 / 86400);

    for (const nft of nfts) {
        console.log(`\nMinting NFT #${nft.tokenId}...`);
        
        // Mint NFT
        const mintTx = await anonStaking.mint(TEST_WALLET, nft.tokenId);
        await mintTx.wait();
        console.log(`✅ Minted NFT #${nft.tokenId}`);

        // Set position (amount, poolId=2 for 1-year stake, lockedUntil, lastPaidDay)
        const setPosTx = await anonStaking.setPosition(
            nft.tokenId,
            nft.amount,          // amount (voting power)
            2,                   // poolId = 2 (1-year stake)
            oneYearFromNow,      // lockedUntil
            currentDay           // lastPaidDay
        );
        await setPosTx.wait();
        console.log(`✅ Set position: ${ethers.utils.formatEther(nft.amount)} power, locked for 1 year`);
    }

    console.log(`\n========================================`);
    console.log(`🎉 Minted ${nfts.length} NFTs to ${TEST_WALLET}`);
    console.log(`========================================`);
    console.log(`\nNFT Summary:`);
    nfts.forEach(nft => {
        console.log(`  - #${nft.tokenId}: ${ethers.utils.formatEther(nft.amount)} voting power`);
    });
    console.log(`\nTotal Voting Power: ${ethers.utils.formatEther(
        nfts.reduce((sum, nft) => sum.add(nft.amount), ethers.BigNumber.from(0))
    )}`);
    console.log(`========================================\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });













