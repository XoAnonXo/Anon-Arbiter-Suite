import { useState } from 'react';
import { ethers } from 'ethers';
import type { UserNFT } from '../hooks/useUserNFTs';
import { CONTRACTS, DISPUTE_RESOLVER_ABI, ANON_STAKING_ABI } from '../config/contracts';
import { txToast } from './Toast';
import './NFTManager.css';

interface NFTManagerProps {
  wrappedNFTs: UserNFT[];
  unwrappedNFTs: UserNFT[];
  onUpdate: () => void;
}

// SVG Icon Components
const PowerIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 2L3 14H12L11 22L21 10H12L13 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const LockIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CheckIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20 6L9 17L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const UnlockIcon = () => (
  <svg width="1em" height="1em" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="currentColor" strokeWidth="2"/>
    <path d="M7 11V7C7 5.67392 7.52678 4.40215 8.46447 3.46447C9.40215 2.52678 10.6739 2 12 2C13.3261 2 14.5979 2.52678 15.5355 3.46447C16.4732 4.40215 17 5.67392 17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Generate a unique image URL based on token ID
const getImageUrl = (tokenId: string) => {
  const images = [
    'https://i.pinimg.com/1200x/93/b6/9f/93b69fd5d973b3f2fbc325982eb8e658.jpg',
    'https://i.pinimg.com/1200x/c5/3e/6e/c53e6e265a893d70b00070563d063606.jpg',
    'https://i.pinimg.com/736x/c6/1c/ae/c61cae893723278b817cd64ffc966bf8.jpg',
    'https://i.pinimg.com/1200x/e1/6c/58/e16c5867c9dcb1334d45cf51caee3563.jpg',
    'https://i.pinimg.com/736x/c0/09/b1/c009b1bd4d8bb5439c59221e2eca7516.jpg',
    'https://i.pinimg.com/736x/fb/27/0f/fb270f928d2af556c9d97f2af5fb908d.jpg',
    'https://i.pinimg.com/1200x/af/5f/3d/af5f3d7fc5d2cd647fc5559c86b61096.jpg',
    'https://i.pinimg.com/736x/a8/13/20/a81320aa1ad808fa2fe9d05d06f06a6c.jpg',
    'https://i.pinimg.com/1200x/4a/2a/8b/4a2a8b8d5c9a4cccc8de1e015119dfb3.jpg',
    'https://i.pinimg.com/1200x/97/67/23/976723dda78a202b1ddbc5fc674c7511.jpg',
    'https://i.pinimg.com/1200x/67/99/6a/67996a2154fd2a8da518e4bfb45c1474.jpg',
    'https://i.pinimg.com/1200x/2a/59/11/2a591199f4558350175dd0b2e120558a.jpg',
  ];
  const index = parseInt(tokenId) % images.length;
  return images[index];
};

// NFT Card Component
interface NFTCardProps {
  nft: UserNFT;
  onAction: () => void;
  actionLabel: string;
  actionColor: 'green' | 'orange';
  loading?: boolean;
  disabled?: boolean;
}

const NFTCard = ({ nft, onAction, actionLabel, actionColor, loading, disabled }: NFTCardProps) => {
  const imageUrl = getImageUrl(nft.tokenId);
  const powerFormatted = parseFloat(nft.power).toLocaleString();
  
  return (
    <div className={`nft-card-new ${disabled ? 'disabled' : ''}`}>
      <div className="nft-card-inner">
        {/* Card Image Section */}
        <div className="nft-image-container">
          <img src={imageUrl} alt={`NFT #${nft.tokenId}`} className="nft-image" />
          
          {/* Status Badge */}
          <div className={`nft-status-badge ${nft.isWrapped ? (nft.canVote ? 'ready' : 'locked') : 'unwrapped'}`}>
            {nft.isWrapped ? (
              nft.canVote ? (
                <>
                  <CheckIcon />
                  <span>Ready</span>
                </>
              ) : (
                <>
                  <LockIcon />
                  <span>Locked</span>
                </>
              )
            ) : (
              <>
                <UnlockIcon />
                <span>Unwrapped</span>
              </>
            )}
          </div>
        </div>

        {/* Card Content Section */}
        <div className="nft-card-content">
          <div className="nft-card-header">
            <h3 className="nft-title">Voting NFT #{nft.tokenId}</h3>
            <PowerIcon />
          </div>

          <p className="nft-subtitle">{nft.isWrapped ? 'Wrapped • Can Vote' : 'Staked • Ready to Wrap'}</p>

          <div className="nft-power-row">
            <span className="nft-power-label">Voting Power</span>
            <span className="nft-power-value">{powerFormatted}</span>
          </div>

          {/* Action Button */}
          <button 
            className={`nft-shimmer-btn ${actionColor}`}
            onClick={(e) => {
              e.stopPropagation();
              onAction();
            }}
            disabled={loading || disabled}
          >
            <div className="shimmer-glow" />
            <span className="shimmer-button-inner">
              {loading ? 'Processing...' : actionLabel}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export function NFTManager({ wrappedNFTs, unwrappedNFTs, onUpdate }: NFTManagerProps) {
  const [loadingTokenId, setLoadingTokenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'wrapped' | 'unwrapped'>('wrapped');

  const handleWrap = async (tokenId: string) => {
    setLoadingTokenId(tokenId);
    setError(null);
    const toastId = txToast.pending(`Wrapping NFT #${tokenId}...`, 'Step 1/2: Approving transfer');

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      const anonStaking = new ethers.Contract(CONTRACTS.ANON_STAKING, ANON_STAKING_ABI, signer);
      const disputeResolver = new ethers.Contract(CONTRACTS.DISPUTE_RESOLVER_HOME, DISPUTE_RESOLVER_ABI, signer);

      // Approve NFT
      const approveTx = await anonStaking.approve(CONTRACTS.DISPUTE_RESOLVER_HOME, tokenId);
      txToast.pending(`Wrapping NFT #${tokenId}...`, 'Step 1/2: Waiting for approval confirmation');
      await approveTx.wait();

      // Deposit
      txToast.pending(`Wrapping NFT #${tokenId}...`, 'Step 2/2: Depositing to DisputeResolver');
      const depositTx = await disputeResolver.depositFor(
        address,
        [ethers.BigNumber.from(tokenId)]
      );
      await depositTx.wait();

      txToast.success(toastId, 'NFT Wrapped!', `NFT #${tokenId} is now ready for voting`, depositTx.hash);
      onUpdate();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Wrap failed';
      setError(errorMsg);
      txToast.error(toastId, 'Wrap Failed', errorMsg);
    } finally {
      setLoadingTokenId(null);
    }
  };

  const handleUnwrap = async (tokenId: string) => {
    setLoadingTokenId(tokenId);
    setError(null);
    const toastId = txToast.pending(`Unwrapping NFT #${tokenId}...`, 'Withdrawing from DisputeResolver');

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = provider.getSigner();
      const address = await signer.getAddress();
      
      const disputeResolver = new ethers.Contract(CONTRACTS.DISPUTE_RESOLVER_HOME, DISPUTE_RESOLVER_ABI, signer);

      const tx = await disputeResolver.withdrawTo(
        address,
        [ethers.BigNumber.from(tokenId)]
      );
      txToast.pending(`Unwrapping NFT #${tokenId}...`, 'Waiting for confirmation');
      await tx.wait();

      txToast.success(toastId, 'NFT Unwrapped!', `NFT #${tokenId} returned to your wallet`, tx.hash);
      onUpdate();
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Unwrap failed';
      setError(errorMsg);
      txToast.error(toastId, 'Unwrap Failed', errorMsg);
    } finally {
      setLoadingTokenId(null);
    }
  };

  // Active power: only NFTs that can vote right now
  const activePower = wrappedNFTs
    .filter(nft => nft.canVote)
    .reduce((sum, nft) => sum + parseFloat(nft.power), 0);
  // Pending power: wrapped NFTs still in cooldown
  const pendingPower = wrappedNFTs
    .filter(nft => !nft.canVote)
    .reduce((sum, nft) => sum + parseFloat(nft.power), 0);
  const totalUnwrappedPower = unwrappedNFTs.reduce((sum, nft) => sum + parseFloat(nft.power), 0);

  return (
    <div className="nft-manager-new">
      {/* Google Font Import */}
      <style>
        {`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&display=swap');`}
      </style>

      <div className="manager-header-new">
        <div className="header-title-section">
          <h2>Your Voting NFTs</h2>
          <p className="header-subtitle">Manage your staked NFTs to participate in dispute resolution</p>
        </div>
        <div className="power-summary-new">
          <div className="power-stat">
            <span className="power-stat-label">Active Power</span>
            <span className="power-stat-value">{activePower.toLocaleString()}</span>
          </div>
          {pendingPower > 0 && (
            <div className="power-stat">
              <span className="power-stat-label">Pending Power</span>
              <span className="power-stat-value pending">{pendingPower.toLocaleString()}</span>
            </div>
          )}
          <div className="power-stat">
            <span className="power-stat-label">Potential Power</span>
            <span className="power-stat-value secondary">{totalUnwrappedPower.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="tabs-row">
        <div className="tabs-new">
          <button 
            className={`tab-new ${activeTab === 'wrapped' ? 'active' : ''}`}
            onClick={() => setActiveTab('wrapped')}
          >
            <span className="tab-icon">🛡️</span>
            Wrapped ({wrappedNFTs.length})
          </button>
          <button 
            className={`tab-new ${activeTab === 'unwrapped' ? 'active' : ''}`}
            onClick={() => setActiveTab('unwrapped')}
          >
            <span className="tab-icon">📦</span>
            Available to Wrap ({unwrappedNFTs.length})
          </button>
        </div>
        <a 
          href="https://staking.heyanon.ai" 
          target="_blank" 
          rel="noopener noreferrer"
          className="shimmer-button-wrapper"
        >
          <div className="shimmer-glow" />
          <span className="shimmer-button-inner">Stake $Anon</span>
        </a>
      </div>

      {error && <div className="error-banner-new">{error}</div>}

{activeTab === 'wrapped' && (
        <div className="nft-section-new">
          {wrappedNFTs.length === 0 ? (
            <div className="empty-state-new">
              <span className="empty-icon">🎫</span>
              <h3>No Wrapped NFTs</h3>
              <p>Wrap your staked ANON NFTs to start voting on disputes!</p>
            </div>
          ) : (
            <div className="nft-grid-new">
              {wrappedNFTs.map(nft => (
                <NFTCard
                  key={nft.tokenId}
                  nft={nft}
                  onAction={() => handleUnwrap(nft.tokenId)}
                  actionLabel="Unwrap"
                  actionColor="orange"
                  loading={loadingTokenId === nft.tokenId}
                  disabled={!nft.canVote}
                />
              ))}
            </div>
          )}
        </div>
      )}

{activeTab === 'unwrapped' && (
        <div className="nft-section-new">
          {unwrappedNFTs.length === 0 ? (
            <div className="empty-state-new">
              <span className="empty-icon">📭</span>
              <h3>No Staking NFTs Found</h3>
              <p>Mint or stake ANON tokens to receive voting NFTs.</p>
            </div>
          ) : (
            <>
              <div className="info-banner-new">
                <span className="info-icon">💡</span>
                <div>
                  <p><strong>Wrap your NFTs</strong> to activate voting power in disputes.</p>
                  <p>Total available power: <span className="highlight">{totalUnwrappedPower.toLocaleString()}</span></p>
                </div>
              </div>
              <div className="nft-grid-new">
                {unwrappedNFTs.map(nft => (
                  <NFTCard
                    key={nft.tokenId}
                    nft={nft}
                    onAction={() => handleWrap(nft.tokenId)}
                    actionLabel="Wrap"
                    actionColor="green"
                    loading={loadingTokenId === nft.tokenId}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
