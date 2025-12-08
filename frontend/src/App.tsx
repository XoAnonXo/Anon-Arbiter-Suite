import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useDisputes } from './hooks/useDisputes';
import { useUserNFTs } from './hooks/useUserNFTs';
import { useMarkets } from './hooks/useMarkets';
import { DisputeCard } from './components/DisputeCard';
import { MarketCard } from './components/MarketCard';
import { NFTManager } from './components/NFTManager';
import { OrbitCarousel } from './components/OrbitCarousel';
import { AsciiLoader } from './components/AsciiLoader';
import { EmptyStateAscii } from './components/EmptyStateAscii';
import { ToastProvider, txToast } from './components/Toast';
import './components/AsciiLoader.css';
import './components/Toast.css';
import './components/MarketCard.css';
import { DisputeState, SONIC_CHAIN, CONTRACTS, ANON_STAKING_ABI, DISPUTE_RESOLVER_ABI, ERC20_ABI, AMM_MARKET_ABI, PARIMUTUEL_MARKET_ABI } from './config/contracts';
import './App.css';

declare global {
  interface Window {
    ethereum?: {
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (event: string, callback: (...args: unknown[]) => void) => void;
    };
  }
}

// Logo SVG Component
const Logo = () => (
  <svg width="40" height="40" viewBox="0 0 49 49" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M34.6509 36.0159C36.8188 35.9919 38.5436 34.1953 38.5436 32.0274V13.6299C38.5436 13.2826 38.2561 12.9951 37.9088 12.9951H36.4116C36.0642 12.9951 35.7768 13.2826 35.7768 13.6299V32.0513C35.7768 32.6861 35.2498 33.2371 34.615 33.2251C33.9921 33.2132 33.4891 32.6981 33.4891 32.0753V27.0447C33.4891 25.1523 33.1178 23.3078 32.3871 21.571C31.6805 19.8942 30.6624 18.397 29.3808 17.1034C28.0992 15.8098 26.59 14.8037 24.9132 14.097C23.1764 13.3664 21.3319 12.9951 19.4394 12.9951H11.0791C10.7318 12.9951 10.4443 13.2826 10.4443 13.6299V15.1391C10.4443 15.4864 10.7318 15.7739 11.0791 15.7739H19.4155C22.4218 15.7739 25.2605 16.9477 27.3805 19.0797C29.5125 21.2117 30.6863 24.0384 30.6863 27.0447V32.0873C30.6863 34.2552 32.471 36.0399 34.6509 36.0159Z" fill="currentColor" />
    <path d="M19.4155 18.0732C14.4688 18.0732 10.4443 22.0977 10.4443 27.0444C10.4443 31.9911 14.4688 36.0156 19.4155 36.0156C24.3622 36.0156 28.3866 31.9911 28.3866 27.0444C28.3866 22.0977 24.3742 18.0732 19.4155 18.0732ZM19.4155 33.2727C15.9779 33.2727 13.1872 30.4819 13.1872 27.0444C13.1872 23.6069 15.9779 20.8161 19.4155 20.8161C22.853 20.8161 25.6438 23.6069 25.6438 27.0444C25.6438 30.4819 22.853 33.2727 19.4155 33.2727Z" fill="currentColor" />
  </svg>
);

function App() {
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [chainId, setChainId] = useState<number | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [activeView, setActiveView] = useState<'markets' | 'disputes' | 'nfts' | 'howto'>('markets');
  const [filterState, setFilterState] = useState<'all' | 'active' | 'resolved'>('all');
  const [marketFilter, setMarketFilter] = useState<'all' | 'active' | 'arbitration' | 'resolved'>('all');
  const [onlyOurArbiter, setOnlyOurArbiter] = useState(false);
  const [minting, setMinting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [openingDisputeFor, setOpeningDisputeFor] = useState<string | null>(null);

  // Show loader for initial app load
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const { disputes, refetch: refetchDisputes } = useDisputes();
  const { wrappedNFTs, unwrappedNFTs, refetch: refetchNFTs } = useUserNFTs(address);
  const { markets, loading: marketsLoading } = useMarkets(onlyOurArbiter);

  // Filter markets based on selected filter
  const filteredMarkets = markets.filter(m => {
    if (marketFilter === 'active') return !m.isFinalized && !m.arbitrationStarted;
    if (marketFilter === 'arbitration') return m.arbitrationStarted;
    if (marketFilter === 'resolved') return m.isFinalized;
    return true;
  });

  const mintNFT = async () => {
    if (!window.ethereum) {
      txToast.info('Wallet Required', 'Please install MetaMask to continue');
      return;
    }

    setMinting(true);
    const toastId = txToast.pending('Minting NFT...', 'Step 1/2: Creating NFT');

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = provider.getSigner();
      const userAddress = await signer.getAddress();

      const anonStaking = new ethers.Contract(CONTRACTS.ANON_STAKING, ANON_STAKING_ABI, signer);

      // Generate random token ID
      const tokenId = Math.floor(Math.random() * 1000000) + 10000;
      const votingPower = ethers.utils.parseEther('1000'); // 1000 voting power
      const oneYearFromNow = Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60;
      const currentDay = Math.floor(Date.now() / 1000 / 86400);

      // Mint NFT
      const mintTx = await anonStaking.mint(userAddress, tokenId);
      txToast.pending('Minting NFT...', `Step 1/2: Waiting for confirmation`);
      await mintTx.wait();

      // Set position
      txToast.pending('Setting Position...', `Step 2/2: Configuring voting power`);
      const setPosTx = await anonStaking.setPosition(
        tokenId,
        votingPower,
        2, // 1-year pool
        oneYearFromNow,
        currentDay
      );
      await setPosTx.wait();

      txToast.success(toastId, 'NFT Minted!', `NFT #${tokenId} with 1,000 voting power`, setPosTx.hash);
      refetchNFTs();
    } catch (err: unknown) {
      const error = err as Error;
      txToast.error(toastId, 'Mint Failed', error.message);
    } finally {
      setMinting(false);
    }
  };

  const openDispute = async (pollAddress: string, marketAddress: string, collateralToken: string, status: number, reason: string) => {
    if (!window.ethereum || !address) {
      txToast.info('Wallet Required', 'Please connect your wallet to open a dispute');
      return;
    }

    setOpeningDisputeFor(pollAddress);
    const toastId = txToast.pending('Opening Dispute...', 'Fetching market data...');

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = provider.getSigner();

      const disputeResolver = new ethers.Contract(CONTRACTS.DISPUTE_RESOLVER_HOME, DISPUTE_RESOLVER_ABI, signer);

      // Try to get TVL from market - try AMM first, then Parimutuel
      let tvl: ethers.BigNumber;

      try {
        // Try AMM market (getReserves)
        const ammMarket = new ethers.Contract(marketAddress, AMM_MARKET_ABI, provider);
        const reserves = await ammMarket.getReserves();
        tvl = reserves.tvl;
        console.log('[openDispute] AMM market TVL:', ethers.utils.formatUnits(tvl, 6));
      } catch {
        // Try Parimutuel market (marketState)
        const pariMarket = new ethers.Contract(marketAddress, PARIMUTUEL_MARKET_ABI, provider);
        const state = await pariMarket.marketState();
        tvl = state.collateralTvl;
        console.log('[openDispute] Parimutuel market TVL:', ethers.utils.formatUnits(tvl, 6));
      }

      // Calculate deposit: 1% of TVL, minimum 1 USDC (1e6)
      const MINIMUM_COLLATERAL = ethers.BigNumber.from('1000000'); // 1 USDC
      const depositAmount = tvl.div(100); // 1% of TVL
      const finalDeposit = depositAmount.lt(MINIMUM_COLLATERAL) ? MINIMUM_COLLATERAL : depositAmount;

      // Use collateral token from the hook, fallback to USDC if not available
      const tokenAddress = collateralToken || CONTRACTS.USDC;
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, signer);
      const [decimals, symbol] = await Promise.all([
        token.decimals(),
        token.symbol(),
      ]);

      const formattedDeposit = ethers.utils.formatUnits(finalDeposit, decimals);
      console.log(`[openDispute] Required deposit: ${formattedDeposit} ${symbol}`);

      // Check user's token balance
      const balance = await token.balanceOf(address);
      if (balance.lt(finalDeposit)) {
        txToast.error(toastId, 'Insufficient Balance', `You need at least ${formattedDeposit} ${symbol} to open this dispute`);
        setOpeningDisputeFor(null);
        return;
      }

      // Check current allowance and approve if needed
      txToast.pending('Opening Dispute...', `Step 1/2: Checking ${symbol} allowance...`);
      const allowance = await token.allowance(address, CONTRACTS.DISPUTE_RESOLVER_HOME);

      if (allowance.lt(finalDeposit)) {
        txToast.pending('Opening Dispute...', `Step 1/2: Approving ${formattedDeposit} ${symbol}...`);
        // Approve exact amount + buffer for safety
        const approveAmount = finalDeposit.mul(2);
        const approveTx = await token.approve(CONTRACTS.DISPUTE_RESOLVER_HOME, approveAmount);
        await approveTx.wait();
      }

      // Open the dispute (contract gets market address from oracle internally)
      txToast.pending('Opening Dispute...', `Step 2/2: Opening dispute (${formattedDeposit} ${symbol} deposit)...`);
      const disputeTx = await disputeResolver.openDispute(pollAddress, status, reason);
      await disputeTx.wait();

      txToast.success(toastId, 'Dispute Opened!', `Deposit: ${formattedDeposit} ${symbol}`, disputeTx.hash);

      // Refresh markets to show updated state
      window.location.reload();
    } catch (err: unknown) {
      const error = err as Error;
      console.error('Error opening dispute:', error);

      // Parse common error messages
      let errorMsg = error.message;
      if (errorMsg.includes('insufficient funds')) {
        errorMsg = 'Insufficient token balance for deposit';
      } else if (errorMsg.includes('user rejected')) {
        errorMsg = 'Transaction rejected by user';
      } else if (errorMsg.includes('MarketState')) {
        errorMsg = 'Market is not in a disputable state';
      }

      txToast.error(toastId, 'Failed to Open Dispute', errorMsg);
    } finally {
      setOpeningDisputeFor(null);
    }
  };

  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
    }

    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, []);

  const checkConnection = async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[];
        if (accounts.length > 0) {
          setAddress(accounts[0]);
          const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
          setChainId(parseInt(chainIdHex, 16));
        }
      } catch (err) {
        console.error('Error checking connection:', err);
      }
    }
  };

  const handleAccountsChanged = (accounts: unknown) => {
    const accountsArray = accounts as string[];
    if (accountsArray.length === 0) {
      setAddress(undefined);
    } else {
      setAddress(accountsArray[0]);
    }
  };

  const handleChainChanged = (chainIdHex: unknown) => {
    setChainId(parseInt(chainIdHex as string, 16));
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert('Please install MetaMask or another Web3 wallet');
      return;
    }

    setConnecting(true);
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' }) as string[];
      setAddress(accounts[0]);

      const chainIdHex = await window.ethereum.request({ method: 'eth_chainId' }) as string;
      setChainId(parseInt(chainIdHex, 16));
    } catch (err) {
      console.error('Error connecting:', err);
    } finally {
      setConnecting(false);
    }
  };

  const switchToSonic = async () => {
    if (!window.ethereum) return;

    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: `0x${SONIC_CHAIN.id.toString(16)}` }],
      });
    } catch (switchError: unknown) {
      const error = switchError as { code: number };
      if (error.code === 4902) {
        try {
          await window.ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: `0x${SONIC_CHAIN.id.toString(16)}`,
              chainName: SONIC_CHAIN.name,
              nativeCurrency: SONIC_CHAIN.nativeCurrency,
              rpcUrls: [SONIC_CHAIN.rpcUrls.default.http[0]],
              blockExplorerUrls: [SONIC_CHAIN.blockExplorers.default.url],
            }],
          });
        } catch (addError) {
          console.error('Error adding chain:', addError);
        }
      }
    }
  };

  const filteredDisputes = disputes.filter(d => {
    if (filterState === 'active') return d.state === DisputeState.Active;
    if (filterState === 'resolved') return d.state === DisputeState.Resolved || d.state === DisputeState.Failed;
    return true;
  });

  const isWrongChain = chainId !== null && chainId !== SONIC_CHAIN.id;

  // Show loader during initial load
  if (isLoading) {
    return (
      <>
        <AsciiLoader />
        <ToastProvider />
      </>
    );
  }

  // Removed login gate - users can view markets and disputes without connecting
  // Wallet connection is only required for voting/NFT operations

  return (
    <>
      <ToastProvider />
      <div className="app">
        <header className="header">
          <div className="header-left">
            <div className="logo">
              <div className="logo-icon-svg">
                <Logo />
              </div>
              <span className="logo-text">Arbiter Suite</span>
            </div>

            <nav className="nav">
              <button
                className={`nav-item ${activeView === 'howto' ? 'active' : ''}`}
                onClick={() => setActiveView('howto')}
              >
                How It Works
              </button>
              <button
                className={`nav-item ${activeView === 'markets' ? 'active' : ''}`}
                onClick={() => setActiveView('markets')}
              >
                Markets
              </button>
              <button
                className={`nav-item ${activeView === 'disputes' ? 'active' : ''}`}
                onClick={() => setActiveView('disputes')}
              >
                Disputes
              </button>
              <button
                className={`nav-item ${activeView === 'nfts' ? 'active' : ''}`}
                onClick={() => setActiveView('nfts')}
              >
                My NFTs
              </button>
            </nav>
          </div>

          <div className="header-right">
            <button className="mint-button" onClick={mintNFT} disabled={minting}>
              {minting ? '⏳ Minting...' : '🎫 Mint NFT'}
            </button>
            {address ? (
              <div className="wallet-info">
                {isWrongChain && (
                  <button className="switch-chain" onClick={switchToSonic}>
                    Switch to Sonic
                  </button>
                )}
                <div className="address-display">
                  <span className="chain-indicator" style={{ background: isWrongChain ? '#ef4444' : '#10b981' }} />
                  {address.slice(0, 6)}...{address.slice(-4)}
                </div>
              </div>
            ) : (
              <button className="connect-button" onClick={connectWallet} disabled={connecting}>
                {connecting ? 'Connecting...' : 'Login'}
              </button>
            )}
          </div>
        </header>

        <main className="main">
          {activeView === 'markets' && (
            <>
              <div className="page-header">
                <h1>Markets</h1>
                <p className="subtitle">
                  {onlyOurArbiter
                    ? 'Markets with our Arbiter Suite as designated resolver'
                    : 'All prediction markets from the factory'}
                </p>
              </div>

              <div className="filters">
                <button
                  className={`filter-btn ${!onlyOurArbiter ? 'active' : ''}`}
                  onClick={() => setOnlyOurArbiter(false)}
                  style={{ marginRight: '10px' }}
                >
                  🌐 All Markets
                </button>
                <button
                  className={`filter-btn ${onlyOurArbiter ? 'active' : ''}`}
                  onClick={() => setOnlyOurArbiter(true)}
                  style={{ marginRight: '20px' }}
                >
                  ⚖️ Our Arbiter Only
                </button>

                <button
                  className={`filter-btn ${marketFilter === 'all' ? 'active' : ''}`}
                  onClick={() => setMarketFilter('all')}
                >
                  All ({markets.length})
                </button>
                <button
                  className={`filter-btn ${marketFilter === 'active' ? 'active' : ''}`}
                  onClick={() => setMarketFilter('active')}
                >
                  Active ({markets.filter(m => !m.isFinalized && !m.arbitrationStarted).length})
                </button>
                <button
                  className={`filter-btn ${marketFilter === 'arbitration' ? 'active' : ''}`}
                  onClick={() => setMarketFilter('arbitration')}
                >
                  In Arbitration ({markets.filter(m => m.arbitrationStarted).length})
                </button>
                <button
                  className={`filter-btn ${marketFilter === 'resolved' ? 'active' : ''}`}
                  onClick={() => setMarketFilter('resolved')}
                >
                  Resolved ({markets.filter(m => m.isFinalized).length})
                </button>
              </div>

              {marketsLoading ? (
                <div className="loading-state">
                  <span className="loading-spinner">⏳</span>
                  <p>Loading markets from on-chain...</p>
                </div>
              ) : filteredMarkets.length === 0 ? (
                <EmptyStateAscii
                  title="No markets found"
                  subtitle={`There are no ${marketFilter !== 'all' ? marketFilter : ''} markets with our arbiter at the moment.`}
                />
              ) : (
                <div className="markets-grid">
                  {filteredMarkets.map(market => (
                    <MarketCard
                      key={`${market.pollAddress}-${market.marketAddress}`}
                      market={market}
                      onOpenDispute={(pollAddress, marketAddress, collateralToken, status, reason) => {
                        openDispute(pollAddress, marketAddress, collateralToken, status, reason);
                      }}
                      isOpeningDispute={openingDisputeFor === market.pollAddress}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeView === 'disputes' && (
            <>
              <div className="page-header">
                <h1>Active Disputes</h1>
                <p className="subtitle">Review cases and cast your vote to resolve market disputes</p>
              </div>

              <div className="filters">
                <button
                  className={`filter-btn ${filterState === 'all' ? 'active' : ''}`}
                  onClick={() => setFilterState('all')}
                >
                  All ({disputes.length})
                </button>
                <button
                  className={`filter-btn ${filterState === 'active' ? 'active' : ''}`}
                  onClick={() => setFilterState('active')}
                >
                  Active ({disputes.filter(d => d.state === DisputeState.Active).length})
                </button>
                <button
                  className={`filter-btn ${filterState === 'resolved' ? 'active' : ''}`}
                  onClick={() => setFilterState('resolved')}
                >
                  Resolved ({disputes.filter(d => d.state === DisputeState.Resolved || d.state === DisputeState.Failed).length})
                </button>
              </div>

              {filteredDisputes.length === 0 ? (
                <EmptyStateAscii
                  title="No disputes found"
                  subtitle={`There are no ${filterState !== 'all' ? filterState : ''} disputes at the moment.`}
                />
              ) : (
                <div className="disputes-list">
                  {filteredDisputes.map(dispute => (
                    <DisputeCard
                      key={dispute.oracle}
                      dispute={dispute}
                      userNFTs={wrappedNFTs}
                      onVoteSuccess={() => {
                        refetchDisputes();
                        refetchNFTs();
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {activeView === 'nfts' && (
            <>
              <div className="page-header">
                <h1>Your NFTs</h1>
                <p className="subtitle">Wrap staked ANON NFTs to gain voting power</p>
              </div>

              {!address ? (
                <div className="connect-prompt">
                  <span className="prompt-icon">🔐</span>
                  <h3>Connect Your Wallet</h3>
                  <p>Connect your wallet to view and manage your NFTs</p>
                  <button className="connect-button large" onClick={connectWallet}>
                    Login
                  </button>
                </div>
              ) : (
                <NFTManager
                  wrappedNFTs={wrappedNFTs}
                  unwrappedNFTs={unwrappedNFTs}
                  onUpdate={refetchNFTs}
                />
              )}
            </>
          )}

          {activeView === 'howto' && (
            <div className="howto-page">
              <div className="page-header">
                <h1>How It Works</h1>
                <p className="subtitle">A simple guide to participating in dispute resolution</p>
              </div>

              {/* Orbit Carousel */}
              <OrbitCarousel onVoteClick={() => setActiveView('disputes')} />

              <div className="howto-content howto-grid">
                {/* What is this */}
                <section className="howto-section">
                  <div className="howto-number">1</div>
                  <div className="howto-text">
                    <h3>What is Arbiter Suite?</h3>
                    <p>
                      When a prediction market result looks wrong, anyone can challenge it.
                      Token holders then vote to decide the correct outcome.
                      Think of it as a <strong>community jury</strong> for market disputes.
                    </p>
                  </div>
                </section>

                {/* Get Voting Power */}
                <section className="howto-section">
                  <div className="howto-number">2</div>
                  <div className="howto-text">
                    <h3>Get Voting Power</h3>
                    <p>
                      To vote on disputes, you need <strong>Voting NFTs</strong>. Here's how:
                    </p>
                    <ul className="howto-list">
                      <li>Stake your ANON tokens to receive a Staking NFT</li>
                      <li>Go to <strong>"My NFTs"</strong> tab</li>
                      <li>Click <strong>"Wrap"</strong> to convert your Staking NFT into a Voting NFT</li>
                      <li>Your voting power = amount of tokens staked</li>
                    </ul>
                  </div>
                </section>

                {/* Vote on Disputes */}
                <section className="howto-section">
                  <div className="howto-number">3</div>
                  <div className="howto-text">
                    <h3>Vote on Disputes</h3>
                    <p>
                      When a dispute is active, you can cast your vote:
                    </p>
                    <ul className="howto-list">
                      <li><strong>Yes</strong> — The market result was correct</li>
                      <li><strong>No</strong> — The market result was wrong</li>
                      <li><strong>Unknown</strong> — Cannot determine the outcome</li>
                    </ul>
                    <p className="howto-note">
                      Select your NFTs and submit your vote. The option with the most voting power wins.
                    </p>
                  </div>
                </section>

                {/* Earn Rewards */}
                <section className="howto-section">
                  <div className="howto-number">4</div>
                  <div className="howto-text">
                    <h3>Earn Rewards</h3>
                    <p>
                      <strong>All voters get paid!</strong> When a dispute resolves:
                    </p>
                    <ul className="howto-list">
                      <li>80% of the dispute deposit goes to voters</li>
                      <li>Rewards are proportional to your voting power</li>
                      <li>You earn regardless of which side you voted for</li>
                    </ul>
                    <p className="howto-note">
                      The more you participate, the more you earn.
                    </p>
                  </div>
                </section>

                {/* Penalty System */}
                <section className="howto-section warning">
                  <div className="howto-number">⚠</div>
                  <div className="howto-text">
                    <h3>Penalty for Wrong Votes</h3>
                    <p>
                      If you vote <strong>against the consensus</strong> (the losing side), your NFT may receive a penalty:
                    </p>
                    <ul className="howto-list">
                      <li>Your NFT will be <strong>blocked</strong> from unwrapping</li>
                      <li>You cannot transfer or withdraw the NFT</li>
                      <li>You must <strong>pay the penalty fee</strong> to unblock it</li>
                      <li>Once paid, your NFT is free to use again</li>
                    </ul>
                    <p className="howto-note">
                      💡 Vote carefully! Consider the evidence before choosing a side. Malicious or careless voting has consequences.
                    </p>
                  </div>
                </section>

                {/* Important Rules */}
                <section className="howto-section highlight">
                  <div className="howto-number">!</div>
                  <div className="howto-text">
                    <h3>Important Rules</h3>
                    <ul className="howto-list">
                      <li><strong>60-hour cooldown</strong> after wrapping before you can vote</li>
                      <li><strong>NFTs are locked</strong> for 60 hours after voting</li>
                      <li><strong>One vote per NFT</strong> per dispute</li>
                      <li><strong>Voting period is limited</strong> — vote before time runs out</li>
                    </ul>
                  </div>
                </section>

              </div>
            </div>
          )}
        </main>

        <footer className="footer">
          <p>Powered by Heyanon.ai</p>
        </footer>
      </div>
    </>
  );
}

export default App;
