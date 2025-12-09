import { ethers } from 'hardhat'

async function main() {
    const USDC_ADDRESS = '0xc6020e5492c2892fD63489797ce3d431ae101d5e'
    const RECIPIENT = '0xE69d294c8c81A6c9444Fb0183458104E03458389'

    const [signer] = await ethers.getSigners()
    console.log(`Signer: ${signer.address}`)

    // Use a generic interface to check what we're dealing with
    const erc20ABI = [
        'function name() view returns (string)',
        'function symbol() view returns (string)',
        'function decimals() view returns (uint8)',
        'function balanceOf(address) view returns (uint256)',
        'function mint(address to, uint256 amount)',
        'function mintToSelf(uint256 amount)',
        'function owner() view returns (address)',
    ]
    
    const usdc = new ethers.Contract(USDC_ADDRESS, erc20ABI, signer)
    
    // Check token info
    try {
        const name = await usdc.name()
        const symbol = await usdc.symbol()
        const decimals = await usdc.decimals()
        console.log(`Token: ${name} (${symbol}), decimals: ${decimals}`)
        
        const AMOUNT = ethers.utils.parseUnits('10000000', decimals) // 10M with correct decimals
        
        const balanceBefore = await usdc.balanceOf(RECIPIENT)
        console.log(`Balance before: ${ethers.utils.formatUnits(balanceBefore, decimals)} ${symbol}`)
        
        // Try owner check
        try {
            const owner = await usdc.owner()
            console.log(`Contract owner: ${owner}`)
            console.log(`Signer is owner: ${owner.toLowerCase() === signer.address.toLowerCase()}`)
        } catch (e) {
            console.log(`No owner() function - might be standard ERC20`)
        }
        
        // Try mint to recipient (as owner)
        console.log(`\nAttempting mint(${RECIPIENT}, 10M)...`)
        const tx = await usdc.mint(RECIPIENT, AMOUNT, { gasLimit: 200000 })
        await tx.wait()
        console.log(`✅ Minted! Tx: ${tx.hash}`)
        
        const balanceAfter = await usdc.balanceOf(RECIPIENT)
        console.log(`Balance after: ${ethers.utils.formatUnits(balanceAfter, decimals)} ${symbol}`)
    } catch (error: any) {
        console.error(`Error: ${error.message}`)
        if (error.reason) console.error(`Reason: ${error.reason}`)
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error)
        process.exit(1)
    })










