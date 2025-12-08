import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';
import { expect } from 'chai';
import { ethers, deployments } from 'hardhat';
import '@nomiclabs/hardhat-waffle';
import { Contract, ContractFactory } from 'ethers';
import { Options } from '@layerzerolabs/lz-v2-utilities';
import {
    DisputeResolverHome,
    DisputeResolverRemote,
    MockAnonStaking,
    MockERC20,
    MockOracle,
    MockMarket,
    MockMarketFactory,
    Vault,
} from "../typechain-types";
import { boolean } from 'hardhat/internal/core/params/argumentTypes';

// Helper functions for ethers v5 compatibility
const time = {
    latest: async () => {
        const block = await ethers.provider.getBlock('latest');
        return block.timestamp;
    },
    increaseTo: async (timestamp: number | bigint) => {
        await ethers.provider.send('evm_setNextBlockTimestamp', [Number(timestamp)]);
        await ethers.provider.send('evm_mine', []);
    },
    increase: async (seconds: number | bigint) => {
        await ethers.provider.send('evm_increaseTime', [Number(seconds)]);
        await ethers.provider.send('evm_mine', []);
    }
};

const takeSnapshot = async () => {
    const snapshotId = await ethers.provider.send('evm_snapshot', []);
    return {
        restore: async () => {
            await ethers.provider.send('evm_revert', [snapshotId]);
        }
    };
};

const impersonateAccount = async (address: string) => {
    await ethers.provider.send('hardhat_impersonateAccount', [address]);
};

type SnapshotRestorer = Awaited<ReturnType<typeof takeSnapshot>>;

describe("DisputeResolver Tests", function () {
    // Constants
    const eidHome = 30284; // Sonic

    let owner: SignerWithAddress;
    let alice: SignerWithAddress;
    let bob: SignerWithAddress;
    let operator: SignerWithAddress;
    let disputer: SignerWithAddress;
    let multisig: SignerWithAddress;

    let afterWrapSnapshot: SnapshotRestorer;
    let mockEndpointHome: Contract;

    let CONTRACT_DISPUTE_RESOLVER_HOME: DisputeResolverHome;
    let CONTRACT_MOCK_ANON_STAKING: MockAnonStaking;
    let CONTRACT_MOCK_ERC20: MockERC20;
    let CONTRACT_MOCK_ORACLE: MockOracle;
    let CONTRACT_MOCK_ORACLE_2: MockOracle;
    let CONTRACT_MOCK_MARKET: MockMarket;
    let CONTRACT_MOCK_MARKET_FACTORY: MockMarketFactory;
    let CONTRACT_VAULT: Vault;

    before(async () => {
        [owner, alice, bob, operator, disputer, multisig] = await ethers.getSigners();

        console.log("\n========================================");
        console.log("Deploying Home Chain Contracts:");
        console.log("========================================");
        console.log("Deployer (owner):", owner.address);

        // Deploy mock LayerZero endpoint for home chain
        const EndpointV2MockArtifact = await deployments.getArtifact('EndpointV2Mock');
        const EndpointV2Mock = new ContractFactory(EndpointV2MockArtifact.abi, EndpointV2MockArtifact.bytecode, owner);
        mockEndpointHome = await EndpointV2Mock.deploy(eidHome);
        await mockEndpointHome.deployed();
        console.log("✅ Mock LayerZero Endpoint:", mockEndpointHome.address);

        // 1. Deploy MockERC20 (USDC with 6 decimals)
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        CONTRACT_MOCK_ERC20 = (await MockERC20Factory.connect(owner).deploy(
            'USD Coin Mock',  // name
            'USDC',           // symbol
            6                 // decimals
        )) as MockERC20;
        await CONTRACT_MOCK_ERC20.deployed();
        console.log("✅ MockERC20 (USDC):", CONTRACT_MOCK_ERC20.address);

        // 2. Deploy MockAnonStaking
        const MockAnonStakingFactory = await ethers.getContractFactory("MockAnonStaking");
        CONTRACT_MOCK_ANON_STAKING = (await MockAnonStakingFactory.connect(owner).deploy()) as MockAnonStaking;
        await CONTRACT_MOCK_ANON_STAKING.deployed();
        console.log("✅ MockAnonStaking:", CONTRACT_MOCK_ANON_STAKING.address);

        // 3. Deploy MockOracle
        const MockOracleFactory = await ethers.getContractFactory("MockOracle");
        CONTRACT_MOCK_ORACLE = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
        await CONTRACT_MOCK_ORACLE.deployed();
        console.log("✅ MockOracle:", CONTRACT_MOCK_ORACLE.address);

        // 4. Deploy MockMarket
        const MockMarketFactory = await ethers.getContractFactory("MockMarket");
        CONTRACT_MOCK_MARKET = (await MockMarketFactory.connect(owner).deploy(CONTRACT_MOCK_ERC20.address)) as MockMarket;
        await CONTRACT_MOCK_MARKET.deployed();
        console.log("✅ MockMarket:", CONTRACT_MOCK_MARKET.address);

        // 5. Deploy MockMarketFactory
        const MockMarketFactoryFactory = await ethers.getContractFactory("MockMarketFactory");
        CONTRACT_MOCK_MARKET_FACTORY = (await MockMarketFactoryFactory.connect(owner).deploy()) as MockMarketFactory;
        await CONTRACT_MOCK_MARKET_FACTORY.deployed();
        console.log("✅ MockMarketFactory:", CONTRACT_MOCK_MARKET_FACTORY.address);

        // 6. Deploy Vault
        const VaultFactory = await ethers.getContractFactory("Vault");
        CONTRACT_VAULT = (await VaultFactory.connect(owner).deploy(owner.address)) as Vault;
        await CONTRACT_VAULT.deployed();
        console.log("✅ Vault:", CONTRACT_VAULT.address);

        // 7. Deploy DisputeResolverHome
        const DisputeResolverHomeFactory = await ethers.getContractFactory("DisputeResolverHome");
        CONTRACT_DISPUTE_RESOLVER_HOME = (await DisputeResolverHomeFactory.connect(owner).deploy(
            mockEndpointHome.address,                 // Mock LayerZero endpoint
            owner.address,                            // Delegate
            CONTRACT_MOCK_ANON_STAKING.address,       // AnonStaking
            CONTRACT_MOCK_MARKET_FACTORY.address,     // MarketFactory
            CONTRACT_VAULT.address                    // Vault
        )) as DisputeResolverHome;
        await CONTRACT_DISPUTE_RESOLVER_HOME.deployed();
        console.log("✅ DisputeResolverHome:", CONTRACT_DISPUTE_RESOLVER_HOME.address);

        // Approve DisputeResolverHome in Vault
        await CONTRACT_VAULT.connect(owner).setApprovedResolver(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);
        console.log("✅ DisputeResolverHome approved in Vault");
        console.log("========================================\n");

        // Mint NFTs for Alice and Bob using batchMintWithData
        console.log("Minting NFTs for testing...");
        const currentTime = await time.latest();

        // Note: batchMintWithData mints with SAME power and lock for all NFTs
        // We'll mint in batches and set different positions after

        // Mint 5 NFTs for Alice (tokenIds 1-5)
        await CONTRACT_MOCK_ANON_STAKING.connect(owner).batchMintWithData(
            alice.address,
            [1, 2, 3, 4, 5],                    // tokenIds
            ethers.utils.parseEther("100"),     // base power
            2,                                  // poolId (1-year staking)
            30                                  // 30 days lock
        );

        // Update positions with different powers and lock times
        for (let i = 1; i <= 5; i++) {
            const power = ethers.utils.parseEther((100 * i).toString()); // 100, 200, 300, 400, 500
            // NFT #1: expired (1 day ago)
            // NFT #2: expires in 10 days (will expire during tests)
            // NFT #3-5: valid for longer (90, 120, 150 days)
            let validTo;
            if (i === 1) {
                validTo = currentTime - (1 * 86400); // expired
            } else if (i === 2) {
                validTo = currentTime + (10 * 86400); // 10 days
            } else {
                validTo = currentTime + (30 * 86400 * i); // 90, 120, 150 days
            }
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setPosition(i, power, 2, validTo, 0);
        }
        console.log("✅ Minted 5 NFTs for Alice (ID 1 EXPIRED, ID 2 expires in 10 days)");

        // Mint 5 NFTs for Bob (tokenIds 6-10)
        await CONTRACT_MOCK_ANON_STAKING.connect(owner).batchMintWithData(
            bob.address,
            [6, 7, 8, 9, 10],                   // tokenIds
            ethers.utils.parseEther("150"),     // base power
            2,                                  // poolId (1-year staking)
            45                                  // 45 days lock
        );

        // Update positions with different powers and lock times
        for (let i = 6; i <= 10; i++) {
            const power = ethers.utils.parseEther((150 * (i - 5)).toString()); // 150, 300, 450, 600, 750
            // NFT #6: expired (1 day ago)
            // NFT #7: expires in 10 days (will expire during tests)
            // NFT #8-10: valid for longer (135, 180, 225 days)
            let validTo;
            if (i === 6) {
                validTo = currentTime - (1 * 86400); // expired
            } else if (i === 7) {
                validTo = currentTime + (10 * 86400); // 10 days
            } else {
                validTo = currentTime + (45 * 86400 * (i - 5)); // 135, 180, 225 days
            }
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setPosition(i, power, 2, validTo, 0);
        }
        console.log("✅ Minted 5 NFTs for Bob (ID 6 EXPIRED, ID 7 expires in 10 days)");
        console.log("========================================\n");
    });

    describe("Initial Setup", function () {
        it("Check block number and deployment", async function () {
            const blockNumber = await ethers.provider.getBlockNumber();
            console.log("current block number", blockNumber);

            expect(blockNumber).to.be.gt(0, "Should have blocks");

            // Verify owner deployed all contracts
            const vaultOwner = await CONTRACT_VAULT.owner();
            expect(vaultOwner).to.eq(owner.address, "Owner should be Vault owner");

            // Verify DisputeResolver is connected to correct contracts
            const anonStakingAddress = await CONTRACT_DISPUTE_RESOLVER_HOME.AnonStaking();
            expect(anonStakingAddress).to.eq(CONTRACT_MOCK_ANON_STAKING.address, "AnonStaking address mismatch");

        });
    });

    describe("Deposit/Wrap Logic", function () {
        it("Should successfully deposit valid NFTs and mint wrapped tokens", async function () {
            // Approve DisputeResolverHome to transfer Alice's NFTs
            await CONTRACT_MOCK_ANON_STAKING.connect(alice).setApprovalForAll(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);

            // Deposit NFTs 2 and 3 (both valid, not expired)
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).depositFor(alice.address, [2, 3]);

            // Verify wrapped NFTs were minted
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(2)).to.eq(alice.address);
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(3)).to.eq(alice.address);

            // Verify original NFTs were transferred to contract
            expect(await CONTRACT_MOCK_ANON_STAKING.ownerOf(2)).to.eq(CONTRACT_DISPUTE_RESOLVER_HOME.address);
            expect(await CONTRACT_MOCK_ANON_STAKING.ownerOf(3)).to.eq(CONTRACT_DISPUTE_RESOLVER_HOME.address);

            // Check wrapped NFT metadata
            const nft2Info = await CONTRACT_DISPUTE_RESOLVER_HOME.nftInfos(2);
            expect(nft2Info.power.toString()).to.eq(ethers.utils.parseEther("200").toString()); // 200 ETH power

            const currentTime = await time.latest();
            const voteCooldown = await CONTRACT_DISPUTE_RESOLVER_HOME.voteCooldown();
            expect(nft2Info.voteDisabledUntil).to.be.closeTo(currentTime + Number(voteCooldown), 5);
            expect(nft2Info.unstakeAvailableAt).to.be.closeTo(currentTime + Number(voteCooldown), 5);
        });

        it("Should revert when depositing expired NFT (StaleNFT)", async function () {
            // Approve for NFT #1 (expired)
            await CONTRACT_MOCK_ANON_STAKING.connect(alice).setApprovalForAll(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);

            // Calculate StaleNFT error selector
            const staleNFTSelector = ethers.utils.id("StaleNFT()").slice(0, 10);

            // Try to deposit expired NFT #1 - should revert with StaleNFT
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).depositFor(alice.address, [1]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                // console.log(error.data);
                // console.log(staleNFTSelector.slice(2));
                expect(error.data).to.include(staleNFTSelector.slice(2), "Should revert with StaleNFT error");
            }
        });

        it("Should revert when depositing NFT with short lock (expires before cooldown)", async function () {
            // Mint NFT with very short lock (1 day) - will be stale
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).mint(alice.address, 99);
            const currentTime = await time.latest();
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setPosition(
                99,
                ethers.utils.parseEther("100"),
                2,
                currentTime + (1 * 86400), // Only 1 day lock
                0
            );

            await CONTRACT_MOCK_ANON_STAKING.connect(alice).setApprovalForAll(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);

            // Calculate StaleNFT error selector
            const staleNFTSelector = ethers.utils.id("StaleNFT()").slice(0, 10);

            // Try to deposit - should fail because lock expires before voteCooldown (60 hours)
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).depositFor(alice.address, [99]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(staleNFTSelector.slice(2), "Should revert with StaleNFT error");
            }
        });

        it("Should revert when depositing empty array", async function () {
            // Calculate EmptyArray error selector
            const emptyArraySelector = ethers.utils.id("EmptyArray()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).depositFor(alice.address, []);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(emptyArraySelector.slice(2), "Should revert with EmptyArray error");
            }
        });

        it("Should revert when depositing NFT from wrong pool (3-month stake, poolId 0)", async function () {
            // Mint NFT with 3-month staking (poolId 0, not poolId 2)
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).mint(alice.address, 100);
            const currentTime = await time.latest();
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setPosition(
                100,
                ethers.utils.parseEther("500"),
                0,                                  // poolId 0 (3-month stake, not 1-year)
                currentTime + (90 * 86400),         // 90 days lock
                0
            );

            await CONTRACT_MOCK_ANON_STAKING.connect(alice).setApprovalForAll(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);

            // Calculate OnlyStakeForYear error selector
            const onlyStakeForYearSelector = ethers.utils.id("OnlyStakeForYear()").slice(0, 10);

            // Should revert because poolId is 0, not 2 (1-year staking required)
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).depositFor(alice.address, [100]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(onlyStakeForYearSelector.slice(2), "Should revert with OnlyStakeForYear error");
            }
        });

        it("Should revert when depositing NFT you don't own", async function () {
            // Alice tries to deposit Bob's NFT #8 (which Bob owns)
            await CONTRACT_MOCK_ANON_STAKING.connect(alice).setApprovalForAll(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);

            // Should revert because Alice doesn't own NFT #8
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).depositFor(alice.address, [8]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                // ERC721InsufficientApproval - Alice can't transfer Bob's NFT
                expect(error.message).to.include("ERC721InsufficientApproval");
            }
        });

        it("Should deposit NFT to different recipient", async function () {
            // Alice deposits her NFT #4 for Bob
            await CONTRACT_MOCK_ANON_STAKING.connect(alice).setApprovalForAll(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).depositFor(bob.address, [4]);

            // Bob should own the wrapped NFT, not Alice
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(4)).to.eq(bob.address);

            // Original NFT still in contract
            expect(await CONTRACT_MOCK_ANON_STAKING.ownerOf(4)).to.eq(CONTRACT_DISPUTE_RESOLVER_HOME.address);
        });

        it("Should deposit multiple NFTs in batch", async function () {
            await CONTRACT_MOCK_ANON_STAKING.connect(bob).setApprovalForAll(CONTRACT_DISPUTE_RESOLVER_HOME.address, true);

            // Deposit Bob's NFTs 7, 8, 9 at once
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).depositFor(bob.address, [7, 8, 9]);

            // Verify all were minted
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(7)).to.eq(bob.address);
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(8)).to.eq(bob.address);
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(9)).to.eq(bob.address);

            // Check total supply: 2 from test 1 (NFTs 2,3) + 1 from test 4 (NFT 4) + 3 from this test (NFTs 7,8,9) = 6
            const totalSupply = await CONTRACT_DISPUTE_RESOLVER_HOME.totalSupply();
            expect(totalSupply.toNumber()).to.eq(6);

            // Advance time by 50 hours to create a "window" for voting actions
            // This ensures disputes created earlier still have time for voting after voteCooldown expires
            // Dispute voting period = 36 hours - 2 hours = 34 hours
            // With 50h buffer + 60h voteCooldown = 72 hours, we need first dispute created after this point
            await time.increase(50 * 60 * 60); // 50 hours

            // Take snapshot after all deposits and time skip
            afterWrapSnapshot = await takeSnapshot();
        });
    });

    describe("Unwrap/Withdraw Logic", function () {
        it("Should revert when trying to unwrap immediately (locked)", async function () {
            // Alice tries to unwrap NFT #2 immediately after deposit (still locked)
            const nftInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.nftInfos(2);
            const currentTime = await time.latest();

            // console.log("Current time:", currentTime);
            // console.log("unstakeAvailableAt:", nftInfo.unstakeAvailableAt);
            // console.log("Time remaining:", Number(nftInfo.unstakeAvailableAt) - currentTime, "seconds");

            // Calculate TooEarly error selector
            const tooEarlySelector = ethers.utils.id("TooEarly()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).withdrawTo(alice.address, [2]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(tooEarlySelector.slice(2), "Should revert with TooEarly error");
            }
        });

        it("Should successfully unwrap after cooldown period expires", async function () {
            // Get voteCooldown and advance time
            const voteCooldown = await CONTRACT_DISPUTE_RESOLVER_HOME.voteCooldown();
            // console.log("Advancing time by:", voteCooldown, "seconds");

            await time.increase(Number(voteCooldown) + 1);

            // Now Alice can unwrap NFT #2
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).withdrawTo(alice.address, [2]);

            // Verify wrapped NFT was burned (should throw ERC721NonexistentToken)
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(2);
                expect.fail("Should have reverted - NFT should be burned");
            } catch (error: any) {
                // Check for ERC721NonexistentToken error
                expect(error.errorName).to.eq("ERC721NonexistentToken");
                // Or check the error selector
                const nonexistentTokenSelector = ethers.utils.id("ERC721NonexistentToken(uint256)").slice(0, 10);
                expect(error.data).to.include(nonexistentTokenSelector.slice(2));
            }

            // Verify original NFT was returned to Alice
            expect(await CONTRACT_MOCK_ANON_STAKING.ownerOf(2)).to.eq(alice.address);

            // Verify total supply decreased
            const totalSupply = await CONTRACT_DISPUTE_RESOLVER_HOME.totalSupply();
            expect(totalSupply.toNumber()).to.eq(5); // 6 - 1 = 5
        });

        it("Should restore to after-wrap state for future tests", async function () {
            // Restore snapshot to state after all wraps (before unwrap tests)
            await afterWrapSnapshot.restore();

            // Verify state is back to 6 wrapped NFTs
            const totalSupply = await CONTRACT_DISPUTE_RESOLVER_HOME.totalSupply();
            expect(totalSupply.toNumber()).to.eq(6);

            // Verify Alice still owns wrapped NFT #2
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(2)).to.eq(alice.address);
        });

        it("Should revert unwrap with penalty, pay penalty, then unwrap successfully", async function () {
            // Take snapshot before penalty test
            const penaltySnapshot = await takeSnapshot();

            // Owner sets penalty token and sets a penalty on NFT #3 (Alice's NFT)
            const penaltyAmount = ethers.utils.parseUnits("50", 6); // 50 USDC penalty
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(owner).setPenaltyToken(CONTRACT_MOCK_ERC20.address);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(owner).setPenalty(3, penaltyAmount);

            // Verify penalty is set
            const penalty = await CONTRACT_DISPUTE_RESOLVER_HOME.penalties(3);
            expect(penalty.eq(penaltyAmount)).to.be.true;

            // Advance time so unwrap cooldown expires
            const voteCooldown = await CONTRACT_DISPUTE_RESOLVER_HOME.voteCooldown();
            await time.increase(Number(voteCooldown) + 1);

            // Calculate TokenBlocked error selector
            const tokenBlockedSelector = ethers.utils.id("TokenBlocked(uint256)").slice(0, 10);

            // Alice tries to unwrap NFT #3 but fails due to penalty
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).withdrawTo(alice.address, [3]);
                expect.fail("Should have reverted with TokenBlocked");
            } catch (error: any) {
                expect(error.data).to.include(tokenBlockedSelector.slice(2), "Should revert with TokenBlocked error");
            }

            // Mint penalty tokens to Alice and approve
            await CONTRACT_MOCK_ERC20.connect(owner).mint(alice.address, penaltyAmount);
            await CONTRACT_MOCK_ERC20.connect(alice).approve(CONTRACT_DISPUTE_RESOLVER_HOME.address, penaltyAmount);

            // Verify vault balance before penalty payment
            const vaultBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(CONTRACT_VAULT.address);

            // Alice pays the penalty
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).payPenalty(3);

            // Verify penalty is cleared
            const penaltyAfterPayment = await CONTRACT_DISPUTE_RESOLVER_HOME.penalties(3);
            expect(penaltyAfterPayment.toNumber()).to.eq(0);

            // Verify penalty was transferred to vault
            const vaultBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(CONTRACT_VAULT.address);
            expect(vaultBalanceAfter.sub(vaultBalanceBefore).eq(penaltyAmount)).to.be.true;

            // Now Alice can unwrap NFT #3 successfully
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).withdrawTo(alice.address, [3]);

            // Verify wrapped NFT was burned
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(3);
                expect.fail("Should have reverted - NFT should be burned");
            } catch (error: any) {
                expect(error.errorName).to.eq("ERC721NonexistentToken");
            }

            // Verify original NFT was returned to Alice
            expect(await CONTRACT_MOCK_ANON_STAKING.ownerOf(3)).to.eq(alice.address);

            // Verify total supply decreased
            const totalSupply = await CONTRACT_DISPUTE_RESOLVER_HOME.totalSupply();
            expect(totalSupply.toNumber()).to.eq(5); // 6 - 1 = 5

            // Restore snapshot to keep NFT #3 wrapped for future tests
            await penaltySnapshot.restore();

            // Verify NFT #3 is still wrapped after restore
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(3)).to.eq(alice.address);
            expect((await CONTRACT_DISPUTE_RESOLVER_HOME.totalSupply()).toNumber()).to.eq(6);
        });
    });

    describe("Dispute Creation", function () {
        before(async function () {
            // Setup: Register oracle → market mapping in MockMarketFactory
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(
                CONTRACT_MOCK_ORACLE.address,
                CONTRACT_MOCK_MARKET.address
            );

            // Setup MockOracle state:
            // - isFinalized = false (dispute can be opened)
            // - status = Yes (has draft answer, not Pending)
            await CONTRACT_MOCK_ORACLE.connect(owner).setStatus(
                false,  // not finalized
                1       // PollStatus.Yes
            );

            // Setup MockMarket TVL with USDC (6 decimals)
            // TVL = 10,000 USDC, collateral required = 10,000 / 100 = 100 USDC minimum
            await CONTRACT_MOCK_MARKET.connect(owner).setTVL(
                ethers.utils.parseUnits("10000", 6)  // TVL in USDC (6 decimals)
            );
        });

        it("Should revert when creating dispute with Pending status", async function () {
            const cannotDisputeWithPendingSelector = ethers.utils.id("CannotDisputeWithPendingStatus()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                    CONTRACT_MOCK_ORACLE.address,
                    0, // VoteOption.Pending
                    "Test reason"
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(cannotDisputeWithPendingSelector.slice(2));
            }
        });

        it("Should revert when reason is too long", async function () {
            const reasonTooLongSelector = ethers.utils.id("ReasonTooLong()").slice(0, 10);
            const longReason = "x".repeat(201); // MAX_REASON_LENGTH is 200

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                    CONTRACT_MOCK_ORACLE.address,
                    2, // VoteOption.No
                    longReason
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(reasonTooLongSelector.slice(2));
            }
        });

        it("Should revert when oracle status is Pending (MarketState)", async function () {
            // Change oracle to Pending status
            await CONTRACT_MOCK_ORACLE.connect(owner).setStatus(false, 0); // PollStatus.Pending

            const marketStateSelector = ethers.utils.id("MarketState()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                    CONTRACT_MOCK_ORACLE.address,
                    2, // VoteOption.No
                    "Oracle has no answer yet"
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(marketStateSelector.slice(2), "Should revert with MarketState");
            }

            // Reset oracle to Yes for next tests
            await CONTRACT_MOCK_ORACLE.connect(owner).setStatus(false, 1); // PollStatus.Yes
        });

        it("Should revert when oracle is already finalized (MarketState)", async function () {
            // Finalize the oracle
            await CONTRACT_MOCK_ORACLE.connect(owner).setStatus(true, 1); // isFinalized = true

            const marketStateSelector = ethers.utils.id("MarketState()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                    CONTRACT_MOCK_ORACLE.address,
                    2, // VoteOption.No
                    "Too late to dispute"
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(marketStateSelector.slice(2), "Should revert with MarketState");
            }

            // Reset oracle to not finalized for next tests
            await CONTRACT_MOCK_ORACLE.connect(owner).setStatus(false, 1); // isFinalized = false, status = Yes
        });

        it("Should revert when disputing with same status as oracle (MarketState)", async function () {
            // Oracle status is Yes (1)
            // Try to create dispute with same status (Yes) - should fail
            const marketStateSelector = ethers.utils.id("MarketState()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                    CONTRACT_MOCK_ORACLE.address,
                    1, // VoteOption.Yes (same as oracle's current status!)
                    "Agree with oracle"
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(marketStateSelector.slice(2), "Should revert with MarketState");
            }
        });

        it("Should revert when creating dispute without token balance (no payment)", async function () {
            // Disputer has no tokens - should fail on transferFrom with 'BP-STF'
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                    CONTRACT_MOCK_ORACLE.address,
                    2, // VoteOption.No
                    "Oracle answered incorrectly"
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                // TransferHelper reverts with "BP-STF" (Balance/Permission - Safe Transfer From)
                expect(error.message).to.include("reverted with reason string 'BP-STF'");
            }
        });

        it("Should successfully create dispute with correct parameters", async function () {
            // Check market TVL via marketState()
            const marketState = await CONTRACT_MOCK_MARKET.marketState();
            const marketTVL = marketState[1]; // collateralTvl (2nd return value)
            // console.log("Market TVL:", ethers.utils.formatUnits(marketTVL, 6), "USDC");

            const requiredCollateral = marketTVL.div(100); // 1% of TVL
            // console.log("Required collateral (1% of TVL):", ethers.utils.formatUnits(requiredCollateral, 6), "USDC");

            // Setup: Mint collateral tokens to disputer
            const collateralAmount = ethers.utils.parseUnits("1000", 6); // 1000 USDC (6 decimals)
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);

            // console.log("Disputer balance:", ethers.utils.formatUnits(collateralAmount, 6), "USDC");

            // Approve tokens
            await CONTRACT_MOCK_ERC20.connect(disputer).approve(
                CONTRACT_DISPUTE_RESOLVER_HOME.address,
                ethers.constants.MaxUint256
            );

            // Create dispute
            const reason = "Oracle answered incorrectly based on sources";
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                CONTRACT_MOCK_ORACLE.address,
                2, // VoteOption.No
                reason
            );

            // Verify dispute was created
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            expect(disputeInfo.disputer).to.eq(disputer.address);
            expect(disputeInfo.state).to.eq(1); // DisputeState.Active
            expect(disputeInfo.draftStatus).to.eq(2); // VoteOption.No
            expect(disputeInfo.reason).to.eq(reason);
            expect(disputeInfo.isCollateralTaken).to.eq(false);

            // Verify endAt timestamp (should be current time + escalation period - apply time)
            const currentTime = await time.latest();
            const escalationPeriod = Number(await CONTRACT_MOCK_ORACLE.ARBITRATION_ESCALATION_PERIOD()); // 432 epochs
            const EPOCH_LENGTH = 5 * 60; // 5 minutes in seconds
            const TIME_FOR_APPLY = 2 * 60 * 60; // 2 hours in seconds
            const expectedEndAt = currentTime + (escalationPeriod * EPOCH_LENGTH) - TIME_FOR_APPLY;

            expect(Number(disputeInfo.endAt)).to.be.closeTo(expectedEndAt, 5); // Allow 5 seconds tolerance

            // Verify startArbitration was called on oracle
            const arbitrationStarted = await CONTRACT_MOCK_ORACLE.arbitrationStarted();
            expect(arbitrationStarted).to.be.true;

            // Verify collateral was transferred
            const disputerDeposit = disputeInfo.disputerDeposit;
            const expectedCollateral = requiredCollateral.lt(ethers.utils.parseUnits("1", 6))
                ? ethers.utils.parseUnits("1", 6) // MINIMUM_COLLATERAL = 1e6 (1 USDC)
                : requiredCollateral; // 1% of TVL

            // console.log("Actual collateral taken:", ethers.utils.formatUnits(disputerDeposit, 6), "USDC");
            expect(disputerDeposit.eq(expectedCollateral)).to.be.true;

            const contractBalance = await CONTRACT_MOCK_ERC20.balanceOf(CONTRACT_DISPUTE_RESOLVER_HOME.address);
            expect(contractBalance.eq(disputerDeposit)).to.be.true;
        });

        it("Should revert when taking collateral immediately (CannotClaimCollateral)", async function () {
            // Try to take collateral right after creating dispute
            const cannotClaimCollateralSelector = ethers.utils.id("CannotClaimCollateral()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).takeCollateral(CONTRACT_MOCK_ORACLE.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                // Should revert - dispute is Active, not Failed or Resolved with disputer winning
                expect(error.data).to.include(cannotClaimCollateralSelector.slice(2), "Should revert with CannotClaimCollateral");
            }
        });

        it("Should revert when creating duplicate dispute for same oracle", async function () {
            // Mint more tokens to disputer
            const collateralAmount = ethers.utils.parseUnits("1000", 6);
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);

            // Try to create another dispute for same oracle - should revert
            let reverted = false;
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                    CONTRACT_MOCK_ORACLE.address,
                    1, // VoteOption.Yes
                    "Different reason"
                );
            } catch (error: any) {
                // Should revert with DisputeAlreadyOpened or other error
                reverted = true;
            }
            expect(reverted).to.be.true;

            // Verify original dispute is still active (not replaced)
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            expect(disputeInfo.draftStatus).to.eq(2); // Still VoteOption.No from first dispute
        });
    });

    describe("Claim Stake Rewards", function () {
        before(async function () {
            // Set up rewards in MockAnonStaking for wrapped NFTs
            // Alice's NFTs: 2, 3 (penalty test is restored via snapshot)
            // Bob's NFTs: 4, 7, 8, 9
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setReward(1, ethers.utils.parseEther("5"));
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setReward(2, ethers.utils.parseEther("10"));
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setReward(3, ethers.utils.parseEther("20"));
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setReward(4, ethers.utils.parseEther("15"));

            // Bob's NFTs: 7, 8, 9
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setReward(7, ethers.utils.parseEther("25"));
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setReward(8, ethers.utils.parseEther("30"));
            await CONTRACT_MOCK_ANON_STAKING.connect(owner).setReward(9, ethers.utils.parseEther("35"));
        });

        it("Should allow Alice to claim rewards for her stake NFT using wrap NFT", async function () {
            // Check reward before claiming
            const positionBefore = await CONTRACT_MOCK_ANON_STAKING.positionOf(2);
            expect(positionBefore.pending.eq(ethers.utils.parseEther("10"))).to.be.true;

            // Alice claims rewards for NFT #2
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimStakeRewards([2]);
            const receipt = await tx.wait();

            // Check ClaimStakeReward event from receipt
            const claimEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'ClaimStakeReward');

            expect(claimEvent).to.not.be.null;
            expect(claimEvent?.args.voter).to.eq(alice.address);
            expect(claimEvent?.args.tokenId.toNumber()).to.eq(2);
            expect(claimEvent?.args.rewards.eq(ethers.utils.parseEther("10"))).to.be.true;

            // Verify reward was claimed (pendingRewards cleared to 0)
            const positionAfter = await CONTRACT_MOCK_ANON_STAKING.positionOf(2);
            expect(positionAfter.pending.toNumber()).to.eq(0);
        });

        it("Should allow Bob to claim rewards for his stake NFT", async function () {
            // Check reward before claiming
            const positionBefore = await CONTRACT_MOCK_ANON_STAKING.positionOf(7);
            expect(positionBefore.pending.eq(ethers.utils.parseEther("25"))).to.be.true;

            // Bob claims rewards for NFT #7
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimStakeRewards([7]);
            const receipt = await tx.wait();

            // Check event from receipt
            const claimEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'ClaimStakeReward');

            expect(claimEvent?.args.voter).to.eq(bob.address);
            expect(claimEvent?.args.tokenId.toNumber()).to.eq(7);
            expect(claimEvent?.args.rewards.eq(ethers.utils.parseEther("25"))).to.be.true;

            // Verify reward was cleared
            const positionAfter = await CONTRACT_MOCK_ANON_STAKING.positionOf(7);
            expect(positionAfter.pending.toNumber()).to.eq(0);
        });

        it("Should revert when claiming with empty array", async function () {
            const emptyTokenIdsSelector = ethers.utils.id("EmptyTokenIdsArray()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimStakeRewards([]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(emptyTokenIdsSelector.slice(2));
            }
        });

        it("Should revert when non-owner tries to claim rewards", async function () {
            // Bob tries to claim Alice's NFT #3 rewards
            // Should fail on authorization check (happens before checking if rewards exist)
            const notNFTOwnerSelector = ethers.utils.id("NotNFTOwnerOrApproved()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimStakeRewards([3]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(notNFTOwnerSelector.slice(2));
            }
        });

        it("Should revert when claiming rewards with penalty, pay penalty, then claim successfully", async function () {
            // Verify NFT #4 has rewards
            const positionBefore = await CONTRACT_MOCK_ANON_STAKING.positionOf(4);
            expect(positionBefore.pending.eq(ethers.utils.parseEther("15"))).to.be.true;

            // Owner sets a penalty on NFT #4 (Bob's NFT)
            const penaltyAmount = ethers.utils.parseUnits("100", 6); // 100 USDC penalty
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(owner).setPenaltyToken(CONTRACT_MOCK_ERC20.address);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(owner).setPenalty(4, penaltyAmount);

            // Verify penalty is set
            const penalty = await CONTRACT_DISPUTE_RESOLVER_HOME.penalties(4);
            expect(penalty.eq(penaltyAmount)).to.be.true;

            // Calculate TokenBlocked error selector
            const tokenBlockedSelector = ethers.utils.id("TokenBlocked(uint256)").slice(0, 10);

            // Bob tries to claim rewards but fails due to penalty
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimStakeRewards([4]);
                expect.fail("Should have reverted with TokenBlocked");
            } catch (error: any) {
                expect(error.data).to.include(tokenBlockedSelector.slice(2), "Should revert with TokenBlocked error");
            }

            // Mint penalty tokens to Bob and approve
            await CONTRACT_MOCK_ERC20.connect(owner).mint(bob.address, penaltyAmount);
            await CONTRACT_MOCK_ERC20.connect(bob).approve(CONTRACT_DISPUTE_RESOLVER_HOME.address, penaltyAmount);

            // Bob pays the penalty
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).payPenalty(4);

            // Verify penalty is cleared
            const penaltyAfterPayment = await CONTRACT_DISPUTE_RESOLVER_HOME.penalties(4);
            expect(penaltyAfterPayment.toNumber()).to.eq(0);

            // Now Bob can claim rewards successfully
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimStakeRewards([4]);
            const receipt = await tx.wait();

            // Check ClaimStakeReward event
            const claimEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'ClaimStakeReward');

            expect(claimEvent).to.not.be.null;
            expect(claimEvent?.args.voter).to.eq(bob.address);
            expect(claimEvent?.args.tokenId.toNumber()).to.eq(4);
            expect(claimEvent?.args.rewards.eq(ethers.utils.parseEther("15"))).to.be.true;

            // Verify reward was cleared
            const positionAfter = await CONTRACT_MOCK_ANON_STAKING.positionOf(4);
            expect(positionAfter.pending.toNumber()).to.eq(0);
        });

        it("Should claim multiple NFTs in batch", async function () {
            // Verify rewards exist before claiming
            // NFT #2 was already claimed in first test, NFT #4 is tested separately in penalty test
            expect((await CONTRACT_MOCK_ANON_STAKING.positionOf(3)).pending.eq(ethers.utils.parseEther("20"))).to.be.true;
            expect((await CONTRACT_MOCK_ANON_STAKING.positionOf(8)).pending.eq(ethers.utils.parseEther("30"))).to.be.true;
            expect((await CONTRACT_MOCK_ANON_STAKING.positionOf(9)).pending.eq(ethers.utils.parseEther("35"))).to.be.true;

            // Alice claims her remaining NFT (3)
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimStakeRewards([3]);

            // Bob claims his remaining NFTs (8, 9) in one batch - NFT #4 and #7 are in other tests
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimStakeRewards([8, 9]);
            const receipt = await tx.wait();

            // Verify ClaimStakeReward events were emitted for both NFTs
            const claimEvents = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .filter((event: any) => event && event.name === 'ClaimStakeReward');

            expect(claimEvents.length).to.eq(2, "Should emit 2 ClaimStakeReward events");
            expect(claimEvents[0]?.args.tokenId.toNumber()).to.eq(8);
            expect(claimEvents[0]?.args.rewards.eq(ethers.utils.parseEther("30"))).to.be.true;
            expect(claimEvents[1]?.args.tokenId.toNumber()).to.eq(9);
            expect(claimEvents[1]?.args.rewards.eq(ethers.utils.parseEther("35"))).to.be.true;

            // Verify all rewards claimed (all cleared to 0)
            expect((await CONTRACT_MOCK_ANON_STAKING.positionOf(3)).pending.toNumber()).to.eq(0);
            expect((await CONTRACT_MOCK_ANON_STAKING.positionOf(8)).pending.toNumber()).to.eq(0);
            expect((await CONTRACT_MOCK_ANON_STAKING.positionOf(9)).pending.toNumber()).to.eq(0);
        });
    });

    describe("Vote Functionality", function () {
        let unwrapSnapshot: SnapshotRestorer;

        before(async function () {
            // Deploy second MockOracle for multiple dispute testing
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");

            CONTRACT_MOCK_ORACLE_2 = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
            await CONTRACT_MOCK_ORACLE_2.deployed();
            await CONTRACT_MOCK_ORACLE_2.connect(owner).setStatus(false, 1); // PollStatus.Yes
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(
                CONTRACT_MOCK_ORACLE_2.address,
                CONTRACT_MOCK_MARKET.address
            );
        });

        it("Should revert when trying to vote immediately after deposit (voting cooldown)", async function () {
            // Alice and Bob just deposited their NFTs, voteCooldown hasn't passed yet
            // Try to vote on first dispute - should fail with NFTLockedVotingCooldown
            const nftLockedSelector = ethers.utils.id("NFTLockedVotingCooldown()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                    CONTRACT_MOCK_ORACLE.address,
                    1, // VoteOption.Yes
                    [2, 3]
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(nftLockedSelector.slice(2), "Alice's NFTs should be locked");
            }

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).vote(
                    CONTRACT_MOCK_ORACLE.address,
                    2, // VoteOption.No
                    [4, 7]
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(nftLockedSelector.slice(2), "Bob's NFTs should be locked");
            }
        });

        it("Should skip voting cooldown period", async function () {
            // Advance time to allow voting
            // We already advanced 50 hours after wrap, so only need to advance remaining time
            const buffer = 50 * 60 * 60; // 50 hours buffer from wrap
            const voteCooldown = await CONTRACT_DISPUTE_RESOLVER_HOME.voteCooldown();
            const remainingTime = Number(voteCooldown) - buffer + 1;
            await time.increase(remainingTime);

            // Verify NFTs are now unlocked for voting
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canVote(2)).to.be.true;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canVote(3)).to.be.true;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canVote(4)).to.be.true;
        });

        it("Should create second dispute for Oracle 2", async function () {
            // Mint collateral tokens to disputer
            const collateralAmount = ethers.utils.parseUnits("1000", 6);
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);
            await CONTRACT_MOCK_ERC20.connect(disputer).approve(
                CONTRACT_DISPUTE_RESOLVER_HOME.address,
                ethers.constants.MaxUint256
            );

            // Create second dispute on MOCK_ORACLE_2
            // Oracle status is Yes, disputer claims it should be Unknown
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                CONTRACT_MOCK_ORACLE_2.address,
                3, // VoteOption.Unknown
                "Oracle data is insufficient for dispute 2"
            );

            // Verify dispute was created
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_2.address);
            expect(disputeInfo.disputer).to.eq(disputer.address);
            expect(disputeInfo.state).to.eq(1); // DisputeState.Active
            expect(disputeInfo.draftStatus).to.eq(3); // VoteOption.Unknown
        });

        it("Should allow Alice to vote on the second dispute", async function () {
            // Alice votes on second dispute (MOCK_ORACLE_2) with NFTs 2 and 3
            // Dispute draftStatus = Unknown, Alice votes Yes (opposite to disputer)
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                CONTRACT_MOCK_ORACLE_2.address,
                1, // VoteOption.Yes
                [2, 3]
            );
            const receipt = await tx.wait();
            // console.log("Gas used for Alice's vote (2 NFTs):", receipt.gasUsed.toString());

            // Check Vote event
            const voteEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'Vote');

            expect(voteEvent).to.not.be.null;
            expect(voteEvent?.args.voter).to.eq(alice.address);
            expect(voteEvent?.args.oracle).to.eq(CONTRACT_MOCK_ORACLE_2.address);

            // Total power = NFT#2 (200 ETH) + NFT#3 (300 ETH) = 500 ETH
            const expectedPower = ethers.utils.parseEther("200").add(ethers.utils.parseEther("300"));
            expect(voteEvent?.args.power.eq(expectedPower)).to.be.true;
            expect(voteEvent?.args.status).to.eq(1); // VoteOption.Yes

            // Verify votes were recorded
            const yesVotes = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteCount(CONTRACT_MOCK_ORACLE_2.address, 1);
            expect(yesVotes.eq(expectedPower)).to.be.true;

            // Verify individual NFTs voted
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE_2.address, 2)).to.be.true;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE_2.address, 3)).to.be.true;

            // Verify NFTs are now locked until unwrapCooldown expires
            const nft2Info = await CONTRACT_DISPUTE_RESOLVER_HOME.nftInfos(2);
            const currentTime = await time.latest();
            const unwrapCooldown = await CONTRACT_DISPUTE_RESOLVER_HOME.unwrapCooldown();
            expect(nft2Info.unstakeAvailableAt).to.be.closeTo(currentTime + Number(unwrapCooldown), 5);
        });

        it("Should revert when voting on non-existent dispute (DisputeNotActive)", async function () {
            // Try to vote on oracle that has no dispute
            const randomOracle = ethers.Wallet.createRandom().address;
            const disputeNotActiveSelector = ethers.utils.id("DisputeNotActive()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                    randomOracle,
                    1, // VoteOption.Yes
                    [2, 3]
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(disputeNotActiveSelector.slice(2), "Should revert with DisputeNotActive");
            }
        });

        it("Should revert when voting with Pending status (CannotVoteForPending)", async function () {
            // Try to vote with VoteOption.Pending (0)
            const cannotVoteForPendingSelector = ethers.utils.id("CannotVoteForPending()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                    CONTRACT_MOCK_ORACLE_2.address,
                    0, // VoteOption.Pending
                    [2, 3]
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(cannotVoteForPendingSelector.slice(2), "Should revert with CannotVoteForPending");
            }
        });

        it("Should revert when voting with empty tokenIds array (EmptyTokenIdsArray)", async function () {
            // Try to vote with empty array
            const emptyTokenIdsArraySelector = ethers.utils.id("EmptyTokenIdsArray()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                    CONTRACT_MOCK_ORACLE_2.address,
                    1, // VoteOption.Yes
                    []
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(emptyTokenIdsArraySelector.slice(2), "Should revert with EmptyTokenIdsArray");
            }
        });

        it("Should revert when trying to transfer or unwrap NFT after voting", async function () {
            // Alice just voted with NFT #2, it should be locked by dispute resolution

            // Calculate error selectors
            const nftLockedDisputeResolutionSelector = ethers.utils.id("NFTLockedDisputeResolution()").slice(0, 10);
            const tooEarlySelector = ethers.utils.id("TooEarly()").slice(0, 10);

            // Try to transfer NFT #2 to Bob - should fail with NFTLockedDisputeResolution
            // After voting, unstakeAvailableAt is updated to block.timestamp + unwrapCooldown
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).transferFrom(alice.address, bob.address, 2);
                expect.fail("Should have reverted when trying to transfer");
            } catch (error: any) {
                expect(error.data).to.include(nftLockedDisputeResolutionSelector.slice(2), "Should revert with NFTLockedDisputeResolution on transfer");
            }

            // Try to unwrap NFT #2 - should fail with TooEarly
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).withdrawTo(alice.address, [2]);
                expect.fail("Should have reverted when trying to unwrap");
            } catch (error: any) {
                expect(error.data).to.include(tooEarlySelector.slice(2), "Should revert with TooEarly on unwrap");
            }

            // Verify NFT is still owned by Alice and locked
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(2)).to.eq(alice.address);
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canUnstake(2)).to.be.false;
        });

        it("Should allow Bob to vote on the second dispute", async function () {
            // Bob votes on second dispute (MOCK_ORACLE_2) with NFTs 4, 7, 8, 9
            // Bob votes No (opposite as disputer's position)
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).vote(
                CONTRACT_MOCK_ORACLE_2.address,
                2, // VoteOption.No
                [4, 7, 8, 9]
            );
            const receipt = await tx.wait();

            // Check Vote event
            const voteEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'Vote');

            // Total power = NFT#4 (400) + NFT#7 (300) + NFT#8 (450) + NFT#9 (600) = 1750 ETH
            const expectedPower = ethers.utils.parseEther("400")
                .add(ethers.utils.parseEther("300"))
                .add(ethers.utils.parseEther("450"))
                .add(ethers.utils.parseEther("600"));
            expect(voteEvent?.args.power.eq(expectedPower)).to.be.true;
            expect(voteEvent?.args.status).to.eq(2); // VoteOption.No

            // Verify votes were recorded
            const noVotes = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteCount(CONTRACT_MOCK_ORACLE_2.address, 2);
            expect(noVotes.eq(expectedPower)).to.be.true;
        });

        it("Should allow Alice and Bob to vote on first dispute while second dispute is active", async function () {
            // Alice votes Yes on first dispute (MOCK_ORACLE) with NFT #2
            // First dispute draftStatus = No, so Alice votes Yes (opposite to disputer)
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                CONTRACT_MOCK_ORACLE.address,
                1, // VoteOption.Yes (opposite to disputer's No)
                [2]
            );

            // Bob votes No on first dispute with NFTs #4 and #9 (same as disputer)
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).vote(
                CONTRACT_MOCK_ORACLE.address,
                2, // VoteOption.No
                [4, 9]
            );

            // Verify votes on first dispute
            const yesVotes = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteCount(CONTRACT_MOCK_ORACLE.address, 1);
            expect(yesVotes.eq(ethers.utils.parseEther("200"))).to.be.true; // NFT#2 power

            const noVotes = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteCount(CONTRACT_MOCK_ORACLE.address, 2);
            const expectedBobPower = ethers.utils.parseEther("400").add(ethers.utils.parseEther("600")); // NFT#4 (400) + NFT#9 (600)
            expect(noVotes.eq(expectedBobPower)).to.be.true;

            // Verify both disputes are still active
            const dispute1 = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            const dispute2 = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_2.address);
            expect(dispute1.state).to.eq(1); // Active
            expect(dispute2.state).to.eq(1); // Active

            // Verify NFTs have voted on both disputes (proving multi-dispute voting works)
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE.address, 2)).to.be.true;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE_2.address, 2)).to.be.true;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE.address, 4)).to.be.true;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE_2.address, 4)).to.be.true;
        });

        it("Should revert when trying to vote twice on same dispute with same NFT", async function () {
            // Alice already voted with NFT #2 on second dispute
            // Try to vote again - should skip the NFT (totalPower will be 0 for NFT #2)
            // But NFT #3 already voted too, so both will be skipped
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                    CONTRACT_MOCK_ORACLE_2.address,
                    1, // VoteOption.Yes
                    [2, 3]
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                // Should revert with NoValidVotes since all NFTs already voted
                const noValidVotesSelector = ethers.utils.id("NoValidVotes()").slice(0, 10);
                expect(error.data).to.include(noValidVotesSelector.slice(2));
            }
        });

        it("Should revert when trying to unwrap NFT that voted (locked by dispute)", async function () {
            // Alice's NFT #2 voted on disputes, should be locked
            const tokenBlockedSelector = ethers.utils.id("TooEarly()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).withdrawTo(alice.address, [2]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(tokenBlockedSelector.slice(2), "Should be locked due to voting");
            }
        });

        it("Should allow unwrap after unwrapCooldown period expires", async function () {
            // Take snapshot before unwrapping
            unwrapSnapshot = await takeSnapshot();

            // Advance time beyond unwrapCooldown
            const unwrapCooldown = await CONTRACT_DISPUTE_RESOLVER_HOME.unwrapCooldown();
            await time.increase(Number(unwrapCooldown) + 1);

            // Now Alice can unwrap NFT #2
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).withdrawTo(alice.address, [2]);

            // Verify NFT #2 was unwrapped
            expect(await CONTRACT_MOCK_ANON_STAKING.ownerOf(2)).to.eq(alice.address);

            // Verify total supply decreased
            const totalSupply = await CONTRACT_DISPUTE_RESOLVER_HOME.totalSupply();
            expect(totalSupply.toNumber()).to.eq(5); // 6 - 1 = 5
        });

        it("Should revert when voting after voting period ended (VotingPeriodEnded)", async function () {
            // After advancing unwrapCooldown (60h) in previous test, the first dispute has expired
            // First dispute was created at T0+50h, expires at T0+84h
            // Current time is approximately T0+60h+60h = T0+120h (way past expiration)

            const votingPeriodEndedSelector = ethers.utils.id("VotingPeriodEnded()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                    CONTRACT_MOCK_ORACLE.address,
                    1, // VoteOption.Yes
                    [3] // Use NFT #3 since #2 was unwrapped
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(votingPeriodEndedSelector.slice(2), "Should revert with VotingPeriodEnded");
            }

            // Restore snapshot to undo unwrap and time advancement
            // This needs to be done here because we need the time advancement to test VotingPeriodEnded
            await unwrapSnapshot.restore();

            // Verify NFT #2 is still wrapped after restore
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(2)).to.eq(alice.address);
            expect((await CONTRACT_DISPUTE_RESOLVER_HOME.totalSupply()).toNumber()).to.eq(6);
        });

        it("Should revert when voting with expired NFT (NFTExpiredInStakingContract)", async function () {
            // Take snapshot before testing with expired NFTs
            const expiredSnapshot = await takeSnapshot();

            // Advance 10 days to make NFT #2 (Alice) and NFT #7 (Bob) expire
            await time.increase(10 * 86400 + 1); // 10 days + 1 second

            // Deploy new oracle and create dispute
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            const CONTRACT_MOCK_ORACLE_EXPIRED = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
            await CONTRACT_MOCK_ORACLE_EXPIRED.deployed();
            await CONTRACT_MOCK_ORACLE_EXPIRED.connect(owner).setStatus(false, 1); // PollStatus.Yes
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(
                CONTRACT_MOCK_ORACLE_EXPIRED.address,
                CONTRACT_MOCK_MARKET.address
            );

            // Create dispute on new oracle
            const collateralAmount = ethers.utils.parseUnits("1000", 6);
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);
            await CONTRACT_MOCK_ERC20.connect(disputer).approve(
                CONTRACT_DISPUTE_RESOLVER_HOME.address,
                ethers.constants.MaxUint256
            );
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                CONTRACT_MOCK_ORACLE_EXPIRED.address,
                2, // VoteOption.No
                "Test expired NFT voting"
            );

            // Calculate error selector
            const nftExpiredSelector = ethers.utils.id("NFTExpiredInStakingContract()").slice(0, 10);

            // Alice tries to vote with expired NFT #2 - should revert
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                    CONTRACT_MOCK_ORACLE_EXPIRED.address,
                    1, // VoteOption.Yes
                    [2]
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(nftExpiredSelector.slice(2), "Should revert with NFTExpiredInStakingContract for Alice");
            }

            // Bob tries to vote with expired NFT #7 - should revert
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).vote(
                    CONTRACT_MOCK_ORACLE_EXPIRED.address,
                    1, // VoteOption.Yes
                    [7]
                );
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(nftExpiredSelector.slice(2), "Should revert with NFTExpiredInStakingContract for Bob");
            }

            // Restore snapshot to undo time advancement
            await expiredSnapshot.restore();

            // Verify NFTs are not expired after restore
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canVote(2)).to.be.true;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canVote(7)).to.be.true;
        });
    });

    describe("Resolve Disputes", function () {
        it("Should revert when trying to resolve dispute before voting period ends", async function () {
            // Try to resolve second dispute before endAt is reached
            const votingPeriodNotEndedSelector = ethers.utils.id("VotingPeriodNotEnded()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(multisig).resolve(CONTRACT_MOCK_ORACLE_2.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(votingPeriodNotEndedSelector.slice(2), "Should revert with VotingPeriodNotEnded");
            }
        });

        it("Should revert when trying to resolve non-existent dispute", async function () {
            // Try to resolve oracle with no dispute
            const randomOracle = ethers.Wallet.createRandom().address;
            const disputeNotActiveSelector = ethers.utils.id("DisputeNotActive()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).resolve(randomOracle);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(disputeNotActiveSelector.slice(2), "Should revert with DisputeNotActive");
            }
        });

        it("Should skip time to reach dispute voting period end", async function () {
            // Get endAt timestamp for second dispute
            const dispute2Info = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_2.address);
            const currentTime = await time.latest();
            const timeRemaining = Number(dispute2Info.endAt) - currentTime;

            // Advance time past endAt
            await time.increase(timeRemaining + 1);

            // Verify voting period has ended
            const newTime = await time.latest();
            expect(newTime).to.be.gt(Number(dispute2Info.endAt), "Current time should be past dispute endAt");
        });

        it("Should successfully resolve first dispute (disputer wins)", async function () {
            // First dispute: Alice voted Yes (200), Bob voted No (1000)
            // Disputer's position: No
            // Winner: No (Bob's side) → disputer WINS

            // When disputer wins, vault needs to top up voter rewards
            // Calculate voter rewards: disputerDeposit * (BPS - PROTOCOL_FEE) / BPS = 100 * 0.8 = 80 USDC
            const dispute1Info = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            const votersReward = dispute1Info.disputerDeposit.mul(8000).div(10000); // 80% of collateral

            // Mint sufficient tokens to vault for topUp
            await CONTRACT_MOCK_ERC20.connect(owner).mint(CONTRACT_VAULT.address, votersReward);

            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(multisig).resolve(CONTRACT_MOCK_ORACLE.address);
            const receipt = await tx.wait();

            // Check DisputeResolved event
            const resolveEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'DisputeResolved');

            expect(resolveEvent).to.not.be.null;
            expect(resolveEvent?.args.oracle).to.eq(CONTRACT_MOCK_ORACLE.address);
            expect(resolveEvent?.args.finalStatus).to.eq(2); // VoteOption.No
            expect(resolveEvent?.args.resolver).to.eq(multisig.address);

            // Verify dispute state is Resolved
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            expect(disputeInfo.state).to.eq(2); // DisputeState.Resolved
            expect(disputeInfo.finalStatus).to.eq(2); // VoteOption.No

            // Verify MockOracle was updated correctly (disputer WINS case)
            const [isFinalized, status] = await CONTRACT_MOCK_ORACLE.getFinalizedStatus();
            expect(isFinalized).to.be.true;
            expect(status).to.eq(2); // PollStatus.No (matches dispute winner)

            // Check ArbitrationResolved event from MockOracle
            const oracleResolveEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_MOCK_ORACLE.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'ArbitrationResolved');

            expect(oracleResolveEvent).to.not.be.null;
            expect(oracleResolveEvent?.args.status).to.eq(2); // PollStatus.No
            // When disputer wins, reason should match the original dispute reason
            expect(oracleResolveEvent?.args.reason).to.eq(disputeInfo.reason);
            expect(disputeInfo.reason).to.eq("Oracle answered incorrectly based on sources");
        });

        it("Should successfully resolve second dispute (disputer loses)", async function () {
            // Second dispute: Alice voted Yes (500), Bob voted No (1750)
            // Disputer's position: Unknown
            // Winner: No (Bob's side with 1750 > Alice's 500) → disputer LOSES

            // Get dispute info and vault balance before resolution
            const disputeInfoBefore = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_2.address);
            const vaultBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(CONTRACT_VAULT.address);

            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).resolve(CONTRACT_MOCK_ORACLE_2.address);
            const receipt = await tx.wait();

            // Check DisputeResolved event
            const resolveEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'DisputeResolved');

            expect(resolveEvent).to.not.be.null;
            expect(resolveEvent?.args.oracle).to.eq(CONTRACT_MOCK_ORACLE_2.address);
            expect(resolveEvent?.args.finalStatus).to.eq(2); // VoteOption.No
            expect(resolveEvent?.args.resolver).to.eq(alice.address);

            // Verify dispute state is Resolved
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_2.address);
            expect(disputeInfo.state).to.eq(2); // DisputeState.Resolved
            expect(disputeInfo.finalStatus).to.eq(2); // VoteOption.No

            // Verify MockOracle was updated correctly (disputer LOSES case)
            const [isFinalized, status] = await CONTRACT_MOCK_ORACLE_2.getFinalizedStatus();
            expect(isFinalized).to.be.true;
            expect(status).to.eq(2); // PollStatus.No (matches dispute winner)

            // Check ArbitrationResolved event from MockOracle
            const oracleResolveEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_MOCK_ORACLE_2.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'ArbitrationResolved');

            expect(oracleResolveEvent).to.not.be.null;
            expect(oracleResolveEvent?.args.status).to.eq(2); // PollStatus.No
            // When disputer loses, reason should be empty string
            expect(oracleResolveEvent?.args.reason).to.eq("");

            // Verify vault received 20% protocol fee (disputer loses case)
            const vaultBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(CONTRACT_VAULT.address);
            const protocolFee = disputeInfoBefore.disputerDeposit.mul(2000).div(10000); // 20% of collateral
            expect(vaultBalanceAfter.sub(vaultBalanceBefore).eq(protocolFee)).to.be.true;
        });

        it("Should revert when trying to resolve already resolved dispute", async function () {
            // Try to resolve second dispute again - it's already in Resolved state
            const disputeNotActiveSelector = ethers.utils.id("DisputeNotActive()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).resolve(CONTRACT_MOCK_ORACLE_2.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(disputeNotActiveSelector.slice(2), "Should revert with DisputeNotActive");
            }

            // Verify dispute is still in Resolved state
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_2.address);
            expect(disputeInfo.state).to.eq(2); // DisputeState.Resolved
        });

        it("Should fail when no one voted, then allow disputer to take collateral", async function () {
            // Take snapshot before test
            const noVotesSnapshot = await takeSnapshot();

            // Deploy new oracle for this test
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            const CONTRACT_MOCK_ORACLE_NO_VOTES = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
            await CONTRACT_MOCK_ORACLE_NO_VOTES.deployed();
            await CONTRACT_MOCK_ORACLE_NO_VOTES.connect(owner).setStatus(false, 1); // PollStatus.Yes
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(
                CONTRACT_MOCK_ORACLE_NO_VOTES.address,
                CONTRACT_MOCK_MARKET.address
            );

            // Create dispute (no one will vote)
            const collateralAmount = ethers.utils.parseUnits("1000", 6);
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);
            await CONTRACT_MOCK_ERC20.connect(disputer).approve(
                CONTRACT_DISPUTE_RESOLVER_HOME.address,
                ethers.constants.MaxUint256
            );
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                CONTRACT_MOCK_ORACLE_NO_VOTES.address,
                2, // VoteOption.No
                "No one will vote on this"
            );

            // Get dispute info before resolution
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_NO_VOTES.address);
            const disputerDeposit = disputeInfo.disputerDeposit;

            // Skip to end of voting period (no votes cast)
            await time.increase(Number(disputeInfo.endAt) - (await time.latest()) + 1);

            // Try to resolve - should revert with NoOneVoted
            const noOneVotedSelector = ethers.utils.id("NoOneVoted()").slice(0, 10);
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).resolve(CONTRACT_MOCK_ORACLE_NO_VOTES.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(noOneVotedSelector.slice(2), "Should revert with NoOneVoted");
            }

            // Disputer can take collateral via takeCollateral (which will set state to Failed since no votes + time expired)
            const disputerBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(disputer.address);
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).takeCollateral(CONTRACT_MOCK_ORACLE_NO_VOTES.address);
            const receipt = await tx.wait();
            const disputerBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(disputer.address);

            // Check DisputeFailed event
            const failedEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'DisputeFailed');

            expect(failedEvent).to.not.be.null;
            expect(failedEvent?.args.oracle).to.eq(CONTRACT_MOCK_ORACLE_NO_VOTES.address);
            expect(failedEvent?.args.disputer).to.eq(disputer.address);

            // Verify collateral was returned
            expect(disputerBalanceAfter.sub(disputerBalanceBefore).eq(disputerDeposit)).to.be.true;

            // Verify dispute state is Failed
            const disputeInfoAfter = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_NO_VOTES.address);
            expect(disputeInfoAfter.state).to.eq(3); // DisputeState.Failed
            expect(disputeInfoAfter.isCollateralTaken).to.be.true;

            // Restore snapshot
            await noVotesSnapshot.restore();
        });

        it("Should handle tie vote (DisputeFailed), then allow disputer to take collateral", async function () {
            // Take snapshot before test
            const tieSnapshot = await takeSnapshot();

            // Deploy new oracle for this test
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            const CONTRACT_MOCK_ORACLE_TIE = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
            await CONTRACT_MOCK_ORACLE_TIE.deployed();
            await CONTRACT_MOCK_ORACLE_TIE.connect(owner).setStatus(false, 1); // PollStatus.Yes
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(
                CONTRACT_MOCK_ORACLE_TIE.address,
                CONTRACT_MOCK_MARKET.address
            );

            // Create dispute
            const collateralAmount = ethers.utils.parseUnits("1000", 6);
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);
            await CONTRACT_MOCK_ERC20.connect(disputer).approve(
                CONTRACT_DISPUTE_RESOLVER_HOME.address,
                ethers.constants.MaxUint256
            );
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                CONTRACT_MOCK_ORACLE_TIE.address,
                2, // VoteOption.No
                "This will result in a tie"
            );

            // Vote with equal power to create tie
            // Alice votes No with NFT #3 (300 ETH)
            // Bob votes Unknown with NFT #7 (300 ETH)
            // This creates a tie: No (300) = Unknown (300)
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                CONTRACT_MOCK_ORACLE_TIE.address,
                2, // VoteOption.No
                [3]
            );

            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).vote(
                CONTRACT_MOCK_ORACLE_TIE.address,
                3, // VoteOption.Unknown
                [7]
            );

            // Skip to end of voting period
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_TIE.address);
            await time.increase(Number(disputeInfo.endAt) - (await time.latest()) + 1);

            // Resolve dispute - should emit DisputeFailed
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).resolve(CONTRACT_MOCK_ORACLE_TIE.address);
            const receipt = await tx.wait();

            // Check DisputeFailed event
            const failedEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'DisputeFailed');

            expect(failedEvent).to.not.be.null;
            expect(failedEvent?.args.oracle).to.eq(CONTRACT_MOCK_ORACLE_TIE.address);
            expect(failedEvent?.args.disputer).to.eq(disputer.address);

            // Verify dispute state is Failed
            const disputeInfoAfter = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_TIE.address);
            expect(disputeInfoAfter.state).to.eq(3); // DisputeState.Failed

            // Disputer takes collateral back
            const disputerBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(disputer.address);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).takeCollateral(CONTRACT_MOCK_ORACLE_TIE.address);
            const disputerBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(disputer.address);

            // Verify collateral was returned
            const disputerDeposit = disputeInfo.disputerDeposit;
            expect(disputerBalanceAfter.sub(disputerBalanceBefore).eq(disputerDeposit)).to.be.true;

            // Verify collateral is marked as taken
            const disputeInfoFinal = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_TIE.address);
            expect(disputeInfoFinal.isCollateralTaken).to.be.true;

            // Restore snapshot
            await tieSnapshot.restore();
        });
    });

    describe("Claim Vote Rewards", function () {
        it("Should revert when claiming from unresolved dispute (DisputeNotResolved)", async function () {
            // Create a new dispute that won't be resolved
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            const CONTRACT_MOCK_ORACLE_UNRESOLVED = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
            await CONTRACT_MOCK_ORACLE_UNRESOLVED.deployed();
            await CONTRACT_MOCK_ORACLE_UNRESOLVED.connect(owner).setStatus(false, 1);
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(
                CONTRACT_MOCK_ORACLE_UNRESOLVED.address,
                CONTRACT_MOCK_MARKET.address
            );

            // Create and vote on dispute (but don't resolve)
            const collateralAmount = ethers.utils.parseUnits("1000", 6);
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);
            await CONTRACT_MOCK_ERC20.connect(disputer).approve(CONTRACT_DISPUTE_RESOLVER_HOME.address, ethers.constants.MaxUint256);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                CONTRACT_MOCK_ORACLE_UNRESOLVED.address,
                2,
                "Unresolved dispute"
            );

            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(CONTRACT_MOCK_ORACLE_UNRESOLVED.address, 1, [2]);

            // Try to claim without resolving
            const disputeNotResolvedSelector = ethers.utils.id("DisputeNotResolved()").slice(0, 10);
            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(CONTRACT_MOCK_ORACLE_UNRESOLVED.address, [2]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(disputeNotResolvedSelector.slice(2), "Should revert with DisputeNotResolved");
            }
        });

        it("Should revert when claiming with empty tokenIds array", async function () {
            const emptyTokenIdsArraySelector = ethers.utils.id("EmptyTokenIdsArray()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(CONTRACT_MOCK_ORACLE.address, []);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(emptyTokenIdsArraySelector.slice(2));
            }
        });

        it("Should revert when non-owner tries to claim", async function () {
            const notNFTOwnerSelector = ethers.utils.id("NotNFTOwnerOrApproved()").slice(0, 10);

            try {
                // Bob tries to claim Alice's NFT #2 rewards
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimVoteRewards(CONTRACT_MOCK_ORACLE.address, [2]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(notNFTOwnerSelector.slice(2));
            }
        });

        it("Should revert when claiming with NFT that didn't vote", async function () {
            const tokenIdDidNotVoteSelector = ethers.utils.id("TokenIdDidNotVote()").slice(0, 10);

            try {
                // NFT #5 was never wrapped, so it couldn't vote
                // But we need a wrapped NFT that didn't vote
                // Actually, all wrapped NFTs (2,3,4,7,8,9) voted on at least one dispute
                // Let's use a dispute where specific NFT didn't vote
                // First dispute: Alice voted with #2, Bob voted with #4, #9
                // So Alice's NFT #3 didn't vote on first dispute
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(CONTRACT_MOCK_ORACLE.address, [3]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(tokenIdDidNotVoteSelector.slice(2));
            }
        });

        it("Should revert when claiming with blocked NFT (penalty set)", async function () {
            // Set penalty on NFT #2
            const penaltyAmount = ethers.utils.parseUnits("50", 6);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(owner).setPenaltyToken(CONTRACT_MOCK_ERC20.address);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(owner).setPenalty(2, penaltyAmount);

            const tokenBlockedSelector = ethers.utils.id("TokenBlocked(uint256)").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(CONTRACT_MOCK_ORACLE.address, [2]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(tokenBlockedSelector.slice(2));
            }

            // Clear penalty for future tests
            await CONTRACT_MOCK_ERC20.connect(owner).mint(alice.address, penaltyAmount);
            await CONTRACT_MOCK_ERC20.connect(alice).approve(CONTRACT_DISPUTE_RESOLVER_HOME.address, penaltyAmount);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).payPenalty(2);
        });

        it("Should allow Alice to claim rewards from first dispute", async function () {
            // First dispute: disputer wins (No wins)
            // Alice voted Yes with NFT #2 (200 power), Bob voted No (1000 power)
            // Total votes: 1200
            // Voter reward pool: disputerDeposit * 80% = 100 USDC * 0.8 = 80 USDC (topped up by vault)
            // Alice's reward: 200 * 80 / 1200 = 13.333333 USDC

            const aliceBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(alice.address);

            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(CONTRACT_MOCK_ORACLE.address, [2]);
            const receipt = await tx.wait();

            // Check VoteRewardClaimed event
            const claimEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'VoteRewardClaimed');

            expect(claimEvent).to.not.be.null;
            expect(claimEvent?.args.voter).to.eq(alice.address);
            expect(claimEvent?.args.oracle).to.eq(CONTRACT_MOCK_ORACLE.address);
            expect(claimEvent?.args.tokenId.toNumber()).to.eq(2);

            // Calculate expected reward
            const dispute1 = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            const voterRewardPool = dispute1.disputerDeposit.mul(8000).div(10000); // 80%
            const totalVoted = ethers.utils.parseEther("1200"); // 200 (Alice) + 1000 (Bob)
            const aliceVotePower = ethers.utils.parseEther("200");
            const expectedReward = aliceVotePower.mul(voterRewardPool).div(totalVoted);

            // Verify reward amount in event
            expect(claimEvent?.args.reward.eq(expectedReward)).to.be.true;

            // Verify exact reward was transferred
            const aliceBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(alice.address);
            expect(aliceBalanceAfter.sub(aliceBalanceBefore).eq(expectedReward)).to.be.true;
        });

        it("Should revert when trying to claim same reward twice", async function () {
            const alreadyClaimedSelector = ethers.utils.id("AlreadyClaimedForTokenId()").slice(0, 10);

            try {
                // Alice already claimed with NFT #2 in previous test
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(CONTRACT_MOCK_ORACLE.address, [2]);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(alreadyClaimedSelector.slice(2));
            }
        });

        it("Should allow Bob to claim rewards from first dispute in batch", async function () {
            // Bob voted No (same as winner) with NFTs #4 (400 power), #9 (600 power)
            // Total votes: 1200
            // Voter reward pool: 80 USDC
            // Bob's rewards: (400 * 80 / 1200) + (600 * 80 / 1200) = 26.666... + 40 = 66.666... USDC

            const bobBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(bob.address);

            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimVoteRewards(CONTRACT_MOCK_ORACLE.address, [4, 9]);
            const receipt = await tx.wait();

            // Check VoteRewardClaimed events
            const claimEvents = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .filter((event: any) => event && event.name === 'VoteRewardClaimed');

            expect(claimEvents.length).to.eq(2, "Should emit 2 VoteRewardClaimed events");

            // Calculate expected rewards
            const dispute1 = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            const voterRewardPool = dispute1.disputerDeposit.mul(8000).div(10000); // 80%
            const totalVoted = ethers.utils.parseEther("1200");
            const nft4Power = ethers.utils.parseEther("400");
            const nft9Power = ethers.utils.parseEther("600");
            const expectedReward4 = nft4Power.mul(voterRewardPool).div(totalVoted);
            const expectedReward9 = nft9Power.mul(voterRewardPool).div(totalVoted);
            const expectedTotalReward = expectedReward4.add(expectedReward9);

            // Verify rewards in events
            expect(claimEvents[0]?.args.reward.eq(expectedReward4)).to.be.true;
            expect(claimEvents[1]?.args.reward.eq(expectedReward9)).to.be.true;

            // Verify exact rewards were transferred
            const bobBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(bob.address);
            expect(bobBalanceAfter.sub(bobBalanceBefore).eq(expectedTotalReward)).to.be.true;
        });

        it("Should allow voters to claim from second dispute", async function () {
            // Second dispute: disputer loses (No wins, disputer wanted Unknown)
            // Alice voted Yes: NFT #2 (200), NFT #3 (300) = 500 power
            // Bob voted No: NFT #4 (400), #7 (300), #8 (450), #9 (600) = 1750 power
            // Total votes: 2250
            // Voter reward pool: 80 USDC (stays in contract, no vault top-up when disputer loses)

            const aliceBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(alice.address);
            const bobBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(bob.address);

            // Get dispute info for calculations
            const dispute2 = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_2.address);
            const voterRewardPool = dispute2.disputerDeposit.mul(8000).div(10000); // 80%
            const totalVoted = ethers.utils.parseEther("2250");

            // Alice claims with NFTs #2, #3
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(CONTRACT_MOCK_ORACLE_2.address, [2, 3]);

            // Calculate Alice's expected reward
            const aliceNft2Power = ethers.utils.parseEther("200");
            const aliceNft3Power = ethers.utils.parseEther("300");
            const aliceExpectedReward2 = aliceNft2Power.mul(voterRewardPool).div(totalVoted);
            const aliceExpectedReward3 = aliceNft3Power.mul(voterRewardPool).div(totalVoted);
            const aliceExpectedTotal = aliceExpectedReward2.add(aliceExpectedReward3);

            // Verify Alice's balance
            const aliceBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(alice.address);
            expect(aliceBalanceAfter.sub(aliceBalanceBefore).eq(aliceExpectedTotal)).to.be.true;

            // Bob claims with NFTs #4, #7, #8, #9
            const tx2 = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimVoteRewards(CONTRACT_MOCK_ORACLE_2.address, [4, 7, 8, 9]);
            const receipt2 = await tx2.wait();

            // Calculate Bob's expected reward
            const bobNft4Power = ethers.utils.parseEther("400");
            const bobNft7Power = ethers.utils.parseEther("300");
            const bobNft8Power = ethers.utils.parseEther("450");
            const bobNft9Power = ethers.utils.parseEther("600");
            const bobExpectedReward4 = bobNft4Power.mul(voterRewardPool).div(totalVoted);
            const bobExpectedReward7 = bobNft7Power.mul(voterRewardPool).div(totalVoted);
            const bobExpectedReward8 = bobNft8Power.mul(voterRewardPool).div(totalVoted);
            const bobExpectedReward9 = bobNft9Power.mul(voterRewardPool).div(totalVoted);
            const bobExpectedTotal = bobExpectedReward4.add(bobExpectedReward7).add(bobExpectedReward8).add(bobExpectedReward9);

            // Verify Bob's balance
            const bobBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(bob.address);
            expect(bobBalanceAfter.sub(bobBalanceBefore).eq(bobExpectedTotal)).to.be.true;
        });

        it("Should allow new NFT owner to claim rewards after transfer", async function () {
            // Take snapshot before test
            const transferSnapshot = await takeSnapshot();

            // Deploy new oracle and create dispute
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            const CONTRACT_MOCK_ORACLE_TRANSFER = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
            await CONTRACT_MOCK_ORACLE_TRANSFER.deployed();
            await CONTRACT_MOCK_ORACLE_TRANSFER.connect(owner).setStatus(false, 1); // PollStatus.Yes
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(
                CONTRACT_MOCK_ORACLE_TRANSFER.address,
                CONTRACT_MOCK_MARKET.address
            );

            // Create dispute
            const collateralAmount = ethers.utils.parseUnits("1000", 6);
            await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);
            await CONTRACT_MOCK_ERC20.connect(disputer).approve(CONTRACT_DISPUTE_RESOLVER_HOME.address, ethers.constants.MaxUint256);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(
                CONTRACT_MOCK_ORACLE_TRANSFER.address,
                2, // VoteOption.No
                "Testing transfer and claim"
            );

            // Alice votes with NFT #3
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(
                CONTRACT_MOCK_ORACLE_TRANSFER.address,
                1, // VoteOption.Yes
                [3]
            );

            // Skip to end of voting period and resolve
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE_TRANSFER.address);
            await time.increase(Number(disputeInfo.endAt) - (await time.latest()) + 1);
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).resolve(CONTRACT_MOCK_ORACLE_TRANSFER.address);

            // Advance time past unwrapCooldown so Alice can transfer NFT
            const unwrapCooldown = await CONTRACT_DISPUTE_RESOLVER_HOME.unwrapCooldown();
            await time.increase(Number(unwrapCooldown) + 1);

            // Alice transfers NFT #3 to Bob
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).transferFrom(alice.address, bob.address, 3);

            // Verify Bob now owns NFT #3
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(3)).to.eq(bob.address);

            // Bob claims the voting rewards for NFT #3 (which Alice didn't claim)
            const bobBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(bob.address);
            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(bob).claimVoteRewards(CONTRACT_MOCK_ORACLE_TRANSFER.address, [3]);
            const receipt = await tx.wait();

            // Check VoteRewardClaimed event (voter is Bob, the current owner)
            const claimEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'VoteRewardClaimed');

            expect(claimEvent).to.not.be.null;
            expect(claimEvent?.args.voter).to.eq(bob.address);
            expect(claimEvent?.args.tokenId.toNumber()).to.eq(3);

            // Calculate expected reward
            const nft3Power = ethers.utils.parseEther("300");
            const voterRewardPool = disputeInfo.disputerDeposit.mul(8000).div(10000);
            const totalVotedTransfer = nft3Power; // Only NFT #3 voted
            const expectedReward = nft3Power.mul(voterRewardPool).div(totalVotedTransfer);

            // Verify exact reward was transferred to Bob
            const bobBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(bob.address);
            expect(bobBalanceAfter.sub(bobBalanceBefore).eq(expectedReward)).to.be.true;

            // Restore snapshot
            await transferSnapshot.restore();

            // Verify NFT #3 is back with Alice
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.ownerOf(3)).to.eq(alice.address);
        });
    });

    describe("Getter Functions", function () {
        it("Should return correct dispute collateral amount for high TVL market", async function () {
            // Market TVL is 10,000 USDC (6 decimals)
            const [collateralAmount, collateralToken] = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeCollateral(CONTRACT_MOCK_ORACLE.address);

            const marketState = await CONTRACT_MOCK_MARKET.marketState();
            const marketTVL = marketState[1]; // collateralTvl
            const expectedCollateral = marketTVL.div(100); // 1% of TVL

            expect(collateralAmount.eq(expectedCollateral)).to.be.true;
            expect(collateralToken).to.eq(CONTRACT_MOCK_ERC20.address);
        });

        it("Should return MINIMUM_COLLATERAL for low TVL market", async function () {
            // Create a market with very low TVL (less than 100 * MINIMUM_COLLATERAL)
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            const lowTvlOracle = await MockOracleFactory.connect(owner).deploy();
            await lowTvlOracle.deployed();
            await lowTvlOracle.connect(owner).setStatus(false, 1); // PollStatus.Yes

            const MockMarketFactory = await ethers.getContractFactory("MockMarket");
            const lowTvlMarket = await MockMarketFactory.connect(owner).deploy(CONTRACT_MOCK_ERC20.address);
            await lowTvlMarket.deployed();

            // Set very low TVL (50 USDC = 50e6)
            await lowTvlMarket.connect(owner).setTVL(ethers.utils.parseUnits("50", 6));

            // Register in factory
            await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(lowTvlOracle.address, lowTvlMarket.address);

            const [collateralAmount, collateralToken] = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeCollateral(lowTvlOracle.address);

            // TVL = 50 USDC, 1% = 0.5 USDC
            // But MINIMUM_COLLATERAL = 1e6 (1 USDC with 6 decimals)
            expect(collateralAmount.eq(1000000)).to.be.true; // MINIMUM_COLLATERAL
            expect(collateralToken).to.eq(CONTRACT_MOCK_ERC20.address);
        });

        it("Should revert when oracle has no market", async function () {
            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            const noMarketOracle = await MockOracleFactory.connect(owner).deploy();
            await noMarketOracle.deployed();

            // Don't register in factory - no market exists
            const marketNotFoundSelector = ethers.utils.id("MarketNotFound()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeCollateral(noMarketOracle.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(marketNotFoundSelector.slice(2), "Should revert with MarketNotFound error");
            }
        });

        it("Should return complete dispute info via getDisputeInfo", async function () {
            // Get first dispute info (already resolved)
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);

            expect(disputeInfo.disputer).to.eq(disputer.address);
            expect(disputeInfo.isCollateralTaken).to.eq(false); // Not taken yet
            expect(disputeInfo.state).to.eq(2); // DisputeState.Resolved
            expect(disputeInfo.draftStatus).to.eq(2); // VoteOption.No
            expect(disputeInfo.finalStatus).to.eq(2); // VoteOption.No (winner)
            expect(disputeInfo.disputerDeposit.gt(0)).to.be.true; // Has collateral
            expect(Number(disputeInfo.endAt)).to.be.gt(0); // Has endAt timestamp
            expect(disputeInfo.marketToken).to.eq(CONTRACT_MOCK_ERC20.address);
            expect(disputeInfo.reason).to.eq("Oracle answered incorrectly based on sources");
        });

        it("Should return correct vote counts via getVoteCount", async function () {
            // First dispute: Alice voted Yes (200), Bob voted No (1000)
            const yesVotes = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteCount(CONTRACT_MOCK_ORACLE.address, 1);
            const noVotes = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteCount(CONTRACT_MOCK_ORACLE.address, 2);
            const unknownVotes = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteCount(CONTRACT_MOCK_ORACLE.address, 3);

            expect(yesVotes.eq(ethers.utils.parseEther("200"))).to.be.true;
            expect(noVotes.eq(ethers.utils.parseEther("1000"))).to.be.true; // NFT #4 (400) + NFT #9 (600)
            expect(unknownVotes.eq(0)).to.be.true;
        });

        it("Should return vote record info via getVoteRecordInfo", async function () {
            // Check Alice's NFT #2 vote on first dispute
            const [power, isClaimed, votedFor] = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteRecordInfo(CONTRACT_MOCK_ORACLE.address, 2);

            expect(power.eq(ethers.utils.parseEther("200"))).to.be.true; // NFT #2 power
            expect(isClaimed).to.be.true; // Alice already claimed
            expect(votedFor).to.eq(1); // VoteOption.Yes

            // Check Bob's NFT #4 vote on first dispute (not claimed yet in this context)
            const [power4, isClaimed4, votedFor4] = await CONTRACT_DISPUTE_RESOLVER_HOME.getVoteRecordInfo(CONTRACT_MOCK_ORACLE.address, 4);

            expect(power4.eq(ethers.utils.parseEther("400"))).to.be.true;
            expect(isClaimed4).to.be.true; // Bob claimed in earlier test
            expect(votedFor4).to.eq(2); // VoteOption.No
        });

        it("Should return correct hasVoted status", async function () {
            // NFTs that voted on first dispute
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE.address, 2)).to.be.true; // Alice's #2
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE.address, 4)).to.be.true; // Bob's #4
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE.address, 9)).to.be.true; // Bob's #9

            // NFT that didn't vote on first dispute
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.hasVoted(CONTRACT_MOCK_ORACLE.address, 3)).to.be.false; // Alice's #3
        });

        it("Should return correct canUnstake status", async function () {
            // After all the time advancements, NFTs should be unstakeable
            // But we need to check the actual state
            const nft2Info = await CONTRACT_DISPUTE_RESOLVER_HOME.nftInfos(2);
            const currentTime = await time.latest();

            if (currentTime > Number(nft2Info.unstakeAvailableAt)) {
                expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canUnstake(2)).to.be.true;
            } else {
                expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canUnstake(2)).to.be.false;
            }
        });

        it("Should return correct canVote status", async function () {
            // Check if NFT #2 can vote (depends on voteDisabledUntil and validTo)
            const nft2Info = await CONTRACT_DISPUTE_RESOLVER_HOME.nftInfos(2);
            const currentTime = await time.latest();

            // NFT can vote if: voteDisabledUntil < currentTime AND validTo > currentTime
            const expectedCanVote = Number(nft2Info.voteDisabledUntil) < currentTime && Number(nft2Info.validTo) > currentTime;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canVote(2)).to.eq(expectedCanVote);

            // NFT #7 might be expired by now (10 day expiry)
            const nft7Info = await CONTRACT_DISPUTE_RESOLVER_HOME.nftInfos(7);
            const expectedCanVote7 = Number(nft7Info.voteDisabledUntil) < currentTime && Number(nft7Info.validTo) > currentTime;
            expect(await CONTRACT_DISPUTE_RESOLVER_HOME.canVote(7)).to.eq(expectedCanVote7);
        });
    });

    describe("Take Collateral", function () {
        it("Should revert when non-disputer tries to take collateral", async function () {
            // Alice tries to take collateral from first dispute (disputer is 'disputer' account)
            const notTheDisputerSelector = ethers.utils.id("NotTheDisputer()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).takeCollateral(CONTRACT_MOCK_ORACLE.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(notTheDisputerSelector.slice(2));
            }
        });

        it("Should revert when disputer tries to take collateral from losing dispute", async function () {
            // Second dispute: disputer lost (wanted Unknown, but No won)
            const cannotClaimCollateralSelector = ethers.utils.id("CannotClaimCollateral()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).takeCollateral(CONTRACT_MOCK_ORACLE_2.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(cannotClaimCollateralSelector.slice(2), "Should revert with CannotClaimCollateral");
            }
        });

        it("Should allow disputer to take collateral when they win", async function () {
            // First dispute: disputer won (wanted No, No won)
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            expect(disputeInfo.state).to.eq(2); // Resolved
            expect(disputeInfo.finalStatus).to.eq(disputeInfo.draftStatus); // Both are No (2)

            const disputerBalanceBefore = await CONTRACT_MOCK_ERC20.balanceOf(disputer.address);

            const tx = await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).takeCollateral(CONTRACT_MOCK_ORACLE.address);
            const receipt = await tx.wait();

            // Check CollateralTaken event
            const collateralEvent = receipt.logs
                .map((log: any) => {
                    try {
                        return CONTRACT_DISPUTE_RESOLVER_HOME.interface.parseLog(log);
                    } catch {
                        return null;
                    }
                })
                .find((event: any) => event && event.name === 'CollateralTaken');

            expect(collateralEvent).to.not.be.null;
            expect(collateralEvent?.args.disputer).to.eq(disputer.address);
            expect(collateralEvent?.args.oracle).to.eq(CONTRACT_MOCK_ORACLE.address);
            expect(collateralEvent?.args.amount.eq(disputeInfo.disputerDeposit)).to.be.true;
            expect(collateralEvent?.args.marketToken).to.eq(CONTRACT_MOCK_ERC20.address);

            // Verify exact collateral amount was returned
            const disputerBalanceAfter = await CONTRACT_MOCK_ERC20.balanceOf(disputer.address);
            expect(disputerBalanceAfter.sub(disputerBalanceBefore).eq(disputeInfo.disputerDeposit)).to.be.true;

            // Verify collateral is marked as taken
            const disputeInfoAfter = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(CONTRACT_MOCK_ORACLE.address);
            expect(disputeInfoAfter.isCollateralTaken).to.be.true;
        });

        it("Should revert when trying to take collateral twice", async function () {
            // Disputer already took collateral from first dispute
            const alreadyTakenSelector = ethers.utils.id("AlreadyTaken()").slice(0, 10);

            try {
                await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).takeCollateral(CONTRACT_MOCK_ORACLE.address);
                expect.fail("Should have reverted");
            } catch (error: any) {
                expect(error.data).to.include(alreadyTakenSelector.slice(2));
            }
        });
    });

    describe("Unclaimed Vote Rewards Tracking", function () {
        it("Should track unclaimed oracles when filtering from paginated slice", async function () {
            // Check Alice's NFT #2 unclaimed rewards
            // NFT #2 voted on: MOCK_ORACLE (claimed), MOCK_ORACLE_2 (claimed), MOCK_ORACLE_UNRESOLVED (not claimed)
            const [total, unclaimed] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(2, 0, 10);

            // Total = 3 (full array length: 3 oracles voted)
            expect(total.toNumber()).to.eq(3);
            // Unclaimed = 1 (MOCK_ORACLE_UNRESOLVED is unresolved, so can't claim yet)
            expect(unclaimed.length).to.eq(1);
        });

        it("Should return unclaimed oracles from paginated slice", async function () {
            // Get Bob's NFT #7 - voted on MOCK_ORACLE_2 only, not claimed yet
            // (NFT #7 didn't vote on MOCK_ORACLE, only on MOCK_ORACLE_2)
            const [total7, unclaimed7] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(7, 0, 10);

            // Total = 1 (NFT #7 voted on one dispute)
            expect(total7.toNumber()).to.eq(1);

            // Check if unclaimed (Bob claimed from second dispute in batch)
            // Actually Bob claimed from second dispute with NFTs 4,7,8,9 so it's claimed
            // console.log("NFT #7 unclaimed count:", unclaimed7.length);
        });

        it("Should handle pagination and filtering", async function () {
            // Get first oracle from NFT #2's votes (offset 0, limit 1)
            const [total, page1] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(2, 0, 1);

            expect(total.toNumber()).to.eq(3); // Full array has 3 oracles
            // page1 contains unclaimed from oracles[0:1] - checks only first oracle

            // Get from different offset (offset 1, limit 2)
            const [, page2] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(2, 1, 2);
            // page2 contains unclaimed from oracles[1:3] (2 elements checked)
        });

        it("Should return empty array for offset beyond total", async function () {
            const [total, unclaimed] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(2, 999, 10);
            expect(total.toNumber()).to.eq(3); // Total is 3 (NFT #2 voted on 3 disputes)
            expect(unclaimed.length).to.eq(0); // But returned array is empty (offset beyond array)
        });

        it("Should return empty for NFT that never voted", async function () {
            const [total, unclaimed] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(999, 0, 10);
            expect(total.toNumber()).to.eq(0);
            expect(unclaimed.length).to.eq(0);
        });
    });
    const paginationTest: boolean = false;
    if (paginationTest) {
        describe("Unclaimed Vote Rewards - Large Scale Pagination Test", function () {
            let testOracles: MockOracle[] = [];
            it("Should handle 500 disputes with pagination and filtering", async function () {
                this.timeout(300000); // 5 minutes timeout for this test

                // Take snapshot before large test
                const largeTestSnapshot = await takeSnapshot();

                console.log("\n========================================");
                console.log("Creating 500 disputes for pagination test...");
                console.log("========================================");

                const MockOracleFactory = await ethers.getContractFactory("MockOracle");

                // Create 500 disputes
                for (let i = 0; i < 500; i++) {
                    // Deploy oracle
                    const oracle = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
                    await oracle.deployed();
                    await oracle.connect(owner).setStatus(false, 1); // PollStatus.Yes
                    await CONTRACT_MOCK_MARKET_FACTORY.connect(owner).setAMMMarket(oracle.address, CONTRACT_MOCK_MARKET.address);
                    testOracles.push(oracle);

                    // Create dispute
                    const collateralAmount = ethers.utils.parseUnits("100", 6);
                    await CONTRACT_MOCK_ERC20.connect(owner).mint(disputer.address, collateralAmount);
                    await CONTRACT_MOCK_ERC20.connect(disputer).approve(CONTRACT_DISPUTE_RESOLVER_HOME.address, collateralAmount);
                    await CONTRACT_DISPUTE_RESOLVER_HOME.connect(disputer).openDispute(oracle.address, 2, `Dispute ${i}`);

                    // Alice votes with NFT #3
                    await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).vote(oracle.address, 1, [3]);

                    if ((i + 1) % 10 === 0) {
                        console.log(`✅ Created and voted on ${i + 1} disputes...`);
                    }
                }

                console.log("✅ All 500 disputes created and voted");

                // Test pagination - get result with limit=1000 (more than total)
                console.log("\nTesting pagination with limit=1000...");
                let allUnclaimed: string[] = [];

                const [total, unclaimed] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(3, 0, 1000);

                console.log(`Page 0: offset=0, total=${total.toNumber()}, returned=${unclaimed.length}`);
                expect(total.toNumber()).to.eq(501); // Total is 501 (NFT #3 voted on MOCK_ORACLE_2 earlier + 500 new)

                allUnclaimed = allUnclaimed.concat(unclaimed);

                // Verify we got 500 unclaimed (MOCK_ORACLE_2 was already claimed earlier, so 501 - 1 = 500)
                expect(allUnclaimed.length).to.eq(500);
                console.log("✅ Retrieved 500 unclaimed oracles via pagination (1 already claimed)");

                // Resolve specific disputes: 100, 101, 250, 251, 252
                console.log("\nResolving and claiming from specific disputes...");
                const indicesToClaim = [100, 101, 250, 251, 252];

                for (const idx of indicesToClaim) {
                    const oracle = testOracles[idx];
                    const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_HOME.getDisputeInfo(oracle.address);

                    // Skip time to end of voting period
                    const currentTime = await time.latest();
                    if (currentTime < Number(disputeInfo.endAt)) {
                        await time.increase(Number(disputeInfo.endAt) - currentTime + 1);
                    }

                    // Resolve
                    await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).resolve(oracle.address);

                    // Claim
                    await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimVoteRewards(oracle.address, [3]);
                }

                console.log(`✅ Claimed rewards from disputes: ${indicesToClaim.join(', ')}`);

                // Test pagination again - should now have 501 - 5 = 496 unclaimed
                console.log("\nTesting pagination after claiming...");

                const [totalAfter, unclaimedAfter] = await CONTRACT_DISPUTE_RESOLVER_HOME.getUnclaimedVoteRewards(3, 0, 1000);

                console.log(`After claim: offset=0, total=${totalAfter.toNumber()}, returned=${unclaimedAfter.length}`);
                expect(totalAfter.toNumber()).to.eq(501); // Total still 501 (array length doesn't change)

                // Verify we got 495 unclaimed (500 unclaimed before - 5 newly claimed = 495)
                // Note: 1 oracle (MOCK_ORACLE_2) was already claimed before this test
                expect(unclaimedAfter.length).to.eq(495);
                console.log("✅ Pagination correctly filtered out 5 claimed disputes");

                // Verify the 5 claimed oracles are NOT in the unclaimed list
                for (const idx of indicesToClaim) {
                    const oracleAddress = testOracles[idx].address;
                    expect(unclaimedAfter.includes(oracleAddress)).to.be.false;
                }
                console.log("✅ Verified claimed oracles are filtered out");

                // Restore snapshot
                await largeTestSnapshot.restore();
                console.log("✅ Snapshot restored");
                console.log("========================================\n");
            });
        });
    }

    describe("Cross-Chain Voting and Claims", function () {
        const eidRemote = 30110; // Arbitrum

        let EndpointV2Mock: ContractFactory;
        let mockEndpointRemote: Contract;
        let CONTRACT_DISPUTE_RESOLVER_REMOTE: DisputeResolverRemote;
        let CONTRACT_REMOTE_VAULT: Vault;
        let CONTRACT_REMOTE_ERC20: MockERC20;
        let CONTRACT_REMOTE_ORACLE: MockOracle;
        let CONTRACT_REMOTE_MARKET: MockMarket;
        let CONTRACT_REMOTE_MARKET_FACTORY: MockMarketFactory;

        before(async function () {
            console.log("\n========================================");
            console.log("Setting up Cross-Chain Test Environment:");
            console.log("========================================");

            // Get EndpointV2Mock factory
            const EndpointV2MockArtifact = await deployments.getArtifact('EndpointV2Mock');
            EndpointV2Mock = new ContractFactory(EndpointV2MockArtifact.abi, EndpointV2MockArtifact.bytecode, owner);

            // Deploy mock endpoint for remote chain (home already deployed in main before())
            mockEndpointRemote = await EndpointV2Mock.deploy(eidRemote);
            console.log("✅ Mock Remote Endpoint deployed");

            // Deploy remote chain contracts
            const MockERC20Factory = await ethers.getContractFactory("MockERC20");
            CONTRACT_REMOTE_ERC20 = (await MockERC20Factory.connect(owner).deploy('Remote USDC', 'rUSDC', 6)) as MockERC20;
            await CONTRACT_REMOTE_ERC20.deployed();

            const MockOracleFactory = await ethers.getContractFactory("MockOracle");
            CONTRACT_REMOTE_ORACLE = (await MockOracleFactory.connect(owner).deploy()) as MockOracle;
            await CONTRACT_REMOTE_ORACLE.deployed();
            await CONTRACT_REMOTE_ORACLE.connect(owner).setStatus(false, 1);

            const MockMarketFactory = await ethers.getContractFactory("MockMarket");
            CONTRACT_REMOTE_MARKET = (await MockMarketFactory.connect(owner).deploy(CONTRACT_REMOTE_ERC20.address)) as MockMarket;
            await CONTRACT_REMOTE_MARKET.deployed();

            const MockMarketFactoryFactory = await ethers.getContractFactory("MockMarketFactory");
            CONTRACT_REMOTE_MARKET_FACTORY = (await MockMarketFactoryFactory.connect(owner).deploy()) as MockMarketFactory;
            await CONTRACT_REMOTE_MARKET_FACTORY.deployed();
            await CONTRACT_REMOTE_MARKET_FACTORY.connect(owner).setAMMMarket(CONTRACT_REMOTE_ORACLE.address, CONTRACT_REMOTE_MARKET.address);

            const VaultFactory = await ethers.getContractFactory("Vault");
            CONTRACT_REMOTE_VAULT = (await VaultFactory.connect(owner).deploy(owner.address)) as Vault;
            await CONTRACT_REMOTE_VAULT.deployed();

            // Deploy DisputeResolverRemote
            const DisputeResolverRemoteFactory = await ethers.getContractFactory("DisputeResolverRemote");
            CONTRACT_DISPUTE_RESOLVER_REMOTE = (await DisputeResolverRemoteFactory.connect(owner).deploy(
                mockEndpointRemote.address,
                owner.address,
                eidHome,
                CONTRACT_REMOTE_MARKET_FACTORY.address,
                CONTRACT_REMOTE_VAULT.address
            )) as DisputeResolverRemote;
            await CONTRACT_DISPUTE_RESOLVER_REMOTE.deployed();
            console.log("✅ Remote chain contracts deployed");

            // Set destination endpoints
            await mockEndpointHome.setDestLzEndpoint(CONTRACT_DISPUTE_RESOLVER_REMOTE.address, mockEndpointRemote.address);
            await mockEndpointRemote.setDestLzEndpoint(CONTRACT_DISPUTE_RESOLVER_HOME.address, mockEndpointHome.address);

            // Set peers
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(owner).setPeer(eidRemote, ethers.utils.zeroPad(CONTRACT_DISPUTE_RESOLVER_REMOTE.address, 32));
            await CONTRACT_DISPUTE_RESOLVER_REMOTE.connect(owner).setPeer(eidHome, ethers.utils.zeroPad(CONTRACT_DISPUTE_RESOLVER_HOME.address, 32));

            console.log("✅ Cross-chain peers configured");
            console.log("========================================\n");
        });

        it("Should return correct dispute collateral for remote chain", async function () {
            // Setup remote market TVL (10,000 USDC)
            await CONTRACT_REMOTE_MARKET.connect(owner).setTVL(ethers.utils.parseUnits("10000", 6));

            const [collateralAmount, collateralToken] = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getDisputeCollateral(CONTRACT_REMOTE_ORACLE.address);

            const marketState = await CONTRACT_REMOTE_MARKET.marketState();
            const marketTVL = marketState[1]; // collateralTvl
            const expectedCollateral = marketTVL.div(100); // 1% of TVL

            expect(collateralAmount.eq(expectedCollateral)).to.be.true;
            expect(collateralToken).to.eq(CONTRACT_REMOTE_ERC20.address);
        });

        it("Should create dispute on remote chain", async function () {
            // Setup remote market TVL
            await CONTRACT_REMOTE_MARKET.connect(owner).setTVL(ethers.utils.parseUnits("10000", 6));

            // Mint collateral to disputer and create remote dispute
            await CONTRACT_REMOTE_ERC20.connect(owner).mint(disputer.address, ethers.utils.parseUnits("1000", 6));
            await CONTRACT_REMOTE_ERC20.connect(disputer).approve(CONTRACT_DISPUTE_RESOLVER_REMOTE.address, ethers.constants.MaxUint256);

            await CONTRACT_DISPUTE_RESOLVER_REMOTE.connect(disputer).openDispute(
                CONTRACT_REMOTE_ORACLE.address,
                2, // VoteOption.No
                "Remote chain dispute"
            );

            // Verify dispute created
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getDisputeInfo(CONTRACT_REMOTE_ORACLE.address);
            expect(disputeInfo.disputer).to.eq(disputer.address);
            expect(disputeInfo.state).to.eq(1); // Active
        });

        it("Should vote on remote dispute from home chain", async function () {
            // Alice votes from home chain on remote dispute using NFTs #2, #3 (already wrapped)
            // This will send LayerZero message to remote
            const options = Options.newOptions().addExecutorLzReceiveOption(300000, 0).toHex().toString();

            const messagingFee = await CONTRACT_DISPUTE_RESOLVER_HOME.quoteVoteOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                1, // VoteOption.Yes
                [2, 3],
                options,
                false
            );

            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).voteOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                1,
                [2, 3],
                options,
                { value: messagingFee.nativeFee }
            );

            // Verify vote was recorded on remote chain
            const yesVotes = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getVoteCount(CONTRACT_REMOTE_ORACLE.address, 1);
            const expectedPower = ethers.utils.parseEther("200").add(ethers.utils.parseEther("300"));
            expect(yesVotes.eq(expectedPower)).to.be.true;
        });

        it("Should prevent double voting on remote dispute with same NFTs", async function () {
            // Get current vote count on remote chain
            const yesVotesBefore = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getVoteCount(CONTRACT_REMOTE_ORACLE.address, 1);

            const options = Options.newOptions().addExecutorLzReceiveOption(300000, 0).toHex().toString();

            const messagingFee = await CONTRACT_DISPUTE_RESOLVER_HOME.quoteVoteOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                1, // VoteOption.Yes
                [2, 3], // Same NFTs Alice already used
                options,
                false
            );

            // Try to vote again with same NFTs - transaction succeeds on Sonic but fails on Base
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).voteOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                1,
                [2, 3],
                options,
                { value: messagingFee.nativeFee }
            );

            // Verify vote count didn't change on remote chain (revert happened on Base)
            const yesVotesAfter = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getVoteCount(CONTRACT_REMOTE_ORACLE.address, 1);
            expect(yesVotesAfter.eq(yesVotesBefore)).to.be.true;
        });

        it("Should prevent voting with different option on same dispute with same NFTs", async function () {
            // Get current vote counts on remote chain
            const yesVotesBefore = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getVoteCount(CONTRACT_REMOTE_ORACLE.address, 1);
            const noVotesBefore = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getVoteCount(CONTRACT_REMOTE_ORACLE.address, 2);

            const options = Options.newOptions().addExecutorLzReceiveOption(300000, 0).toHex().toString();

            const messagingFee = await CONTRACT_DISPUTE_RESOLVER_HOME.quoteVoteOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                2, // VoteOption.No (different from previous Yes vote)
                [2, 3], // Same NFTs Alice already used
                options,
                false
            );

            // Try to change vote with same NFTs - transaction succeeds on Sonic but fails on Base
            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).voteOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                2,
                [2, 3],
                options,
                { value: messagingFee.nativeFee }
            );

            // Verify neither vote count changed on remote chain (revert happened on Base)
            const yesVotesAfter = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getVoteCount(CONTRACT_REMOTE_ORACLE.address, 1);
            const noVotesAfter = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getVoteCount(CONTRACT_REMOTE_ORACLE.address, 2);
            expect(yesVotesAfter.eq(yesVotesBefore)).to.be.true;
            expect(noVotesAfter.eq(noVotesBefore)).to.be.true;
        });

        it("Should claim rewards on remote dispute from home chain", async function () {
            // Skip to end of voting period and resolve remote dispute
            const disputeInfo = await CONTRACT_DISPUTE_RESOLVER_REMOTE.getDisputeInfo(CONTRACT_REMOTE_ORACLE.address);
            await time.increase(Number(disputeInfo.endAt) - (await time.latest()) + 1);
            await CONTRACT_DISPUTE_RESOLVER_REMOTE.connect(alice).resolve(CONTRACT_REMOTE_ORACLE.address);

            // Mint tokens to remote contract for rewards
            const voterRewardPool = disputeInfo.disputerDeposit.mul(8000).div(10000);
            await CONTRACT_REMOTE_ERC20.connect(owner).mint(CONTRACT_DISPUTE_RESOLVER_REMOTE.address, voterRewardPool);

            // Alice claims from home chain
            const options = Options.newOptions().addExecutorLzReceiveOption(400000, 0).toHex().toString();

            const messagingFee = await CONTRACT_DISPUTE_RESOLVER_HOME.quoteClaimOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                [2, 3],
                options,
                false
            );

            const aliceBalanceBefore = await CONTRACT_REMOTE_ERC20.balanceOf(alice.address);

            await CONTRACT_DISPUTE_RESOLVER_HOME.connect(alice).claimRewardsOnRemoteDispute(
                eidRemote,
                CONTRACT_REMOTE_ORACLE.address,
                [2, 3],
                options,
                { value: messagingFee.nativeFee }
            );

            // Verify rewards transferred on remote chain
            const aliceBalanceAfter = await CONTRACT_REMOTE_ERC20.balanceOf(alice.address);
            expect(aliceBalanceAfter.gt(aliceBalanceBefore)).to.be.true;
        });
    });
    // Add more test suites here...
});

