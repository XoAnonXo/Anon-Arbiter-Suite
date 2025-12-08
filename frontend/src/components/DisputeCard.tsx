import { useState } from 'react';
import { ethers } from 'ethers';
import type { Dispute } from '../hooks/useDisputes';
import type { UserNFT } from '../hooks/useUserNFTs';
import { CONTRACTS, DISPUTE_RESOLVER_ABI, VoteOption, DisputeState, VOTE_LABELS, STATE_LABELS } from '../config/contracts';
import { txToast } from './Toast';
import './DisputeCard.css';

interface DisputeCardProps {
  dispute: Dispute;
  userNFTs: UserNFT[];
  onVoteSuccess: () => void;
}

export function DisputeCard({ dispute, userNFTs, onVoteSuccess }: DisputeCardProps) {
  const [selectedVote, setSelectedVote] = useState<VoteOption | null>(null);
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);
  const [voting, setVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const isActive = dispute.state === DisputeState.Active;
  const timeLeft = dispute.endAt * 1000 - Date.now();
  const canVote = isActive && timeLeft > 0;
  
  const eligibleNFTs = userNFTs.filter(nft => nft.isWrapped && nft.canVote);
  const totalPower = eligibleNFTs.reduce((sum, nft) => sum + parseFloat(nft.power), 0);

  const totalVotes = parseFloat(dispute.yesVotes) + parseFloat(dispute.noVotes) + parseFloat(dispute.unknownVotes);
  const yesPercent = totalVotes > 0 ? (parseFloat(dispute.yesVotes) / totalVotes) * 100 : 0;
  const noPercent = totalVotes > 0 ? (parseFloat(dispute.noVotes) / totalVotes) * 100 : 0;
  const unknownPercent = totalVotes > 0 ? (parseFloat(dispute.unknownVotes) / totalVotes) * 100 : 0;

  const handleNFTToggle = (tokenId: string) => {
    setSelectedNFTs(prev => 
      prev.includes(tokenId) 
        ? prev.filter(id => id !== tokenId)
        : [...prev, tokenId]
    );
  };

  const selectAllNFTs = () => {
    setSelectedNFTs(eligibleNFTs.map(nft => nft.tokenId));
  };

  const handleVote = async () => {
    if (!selectedVote || selectedNFTs.length === 0) {
      txToast.info('Selection Required', 'Please select a vote option and at least one NFT');
      setError('Please select a vote option and at least one NFT');
      return;
    }

    setVoting(true);
    setError(null);
    const voteLabel = VOTE_LABELS[selectedVote];
    const toastId = txToast.pending('Submitting Vote...', `Voting "${voteLabel}" with ${selectedNFTs.length} NFT(s)`);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACTS.DISPUTE_RESOLVER_HOME, DISPUTE_RESOLVER_ABI, signer);

      const tx = await contract.vote(
        dispute.oracle,
        selectedVote,
        selectedNFTs.map(id => ethers.BigNumber.from(id))
      );

      txToast.pending('Submitting Vote...', 'Waiting for confirmation');
      await tx.wait();
      
      txToast.success(toastId, 'Vote Submitted!', `Voted "${voteLabel}" with ${selectedNFTs.length} NFT(s)`, tx.hash);
      onVoteSuccess();
      setSelectedVote(null);
      setSelectedNFTs([]);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Vote failed';
      txToast.error(toastId, 'Vote Failed', errorMessage);
      setError(errorMessage);
    } finally {
      setVoting(false);
    }
  };

  const formatTimeLeft = (ms: number) => {
    if (ms <= 0) return 'Ended';
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m left`;
  };

  const getStateColor = (state: DisputeState) => {
    switch (state) {
      case DisputeState.Active: return 'status-active';
      case DisputeState.Resolved: return 'status-resolved';
      case DisputeState.Failed: return 'status-failed';
      default: return 'status-inactive';
    }
  };

  return (
    <div className={`dispute-card ${expanded ? 'expanded' : ''}`}>
      <div className="dispute-header" onClick={() => setExpanded(!expanded)}>
        <div className="dispute-title">
          <span className={`status-badge ${getStateColor(dispute.state)}`}>
            {STATE_LABELS[dispute.state]}
          </span>
          <span className="oracle-address" title={dispute.oracle}>
            {dispute.oracle.slice(0, 8)}...{dispute.oracle.slice(-6)}
          </span>
        </div>
        <div className="dispute-meta">
          <span className="deposit">{parseFloat(dispute.disputerDeposit).toLocaleString()} USDC</span>
          <span className="time-left">{formatTimeLeft(timeLeft)}</span>
        </div>
      </div>

      <div className="dispute-body">
        <div className="dispute-reason">
          <h4>Dispute Reason</h4>
          <p>{dispute.reason || 'No reason provided'}</p>
        </div>

        <div className="dispute-proposed">
          <span>Proposed Resolution: </span>
          <strong className={`vote-${dispute.draftStatus}`}>
            {VOTE_LABELS[dispute.draftStatus]}
          </strong>
        </div>

        <div className="vote-breakdown">
          <h4>Current Votes</h4>
          <div className="vote-bars">
            <div className="vote-bar-container">
              <div className="vote-bar vote-yes" style={{ width: `${yesPercent}%` }} />
              <span className="vote-label">Yes: {parseFloat(dispute.yesVotes).toFixed(0)}</span>
            </div>
            <div className="vote-bar-container">
              <div className="vote-bar vote-no" style={{ width: `${noPercent}%` }} />
              <span className="vote-label">No: {parseFloat(dispute.noVotes).toFixed(0)}</span>
            </div>
            <div className="vote-bar-container">
              <div className="vote-bar vote-unknown" style={{ width: `${unknownPercent}%` }} />
              <span className="vote-label">Unknown: {parseFloat(dispute.unknownVotes).toFixed(0)}</span>
            </div>
          </div>
        </div>

        {canVote && eligibleNFTs.length > 0 && (
          <div className="voting-section">
            <h4>Cast Your Vote</h4>
            
            <div className="vote-options">
              {[VoteOption.Yes, VoteOption.No, VoteOption.Unknown].map(option => (
                <button
                  key={option}
                  className={`vote-option ${selectedVote === option ? 'selected' : ''} vote-${option}`}
                  onClick={() => setSelectedVote(option)}
                >
                  {VOTE_LABELS[option]}
                </button>
              ))}
            </div>

            <div className="nft-selection">
              <div className="nft-header">
                <span>Select NFTs ({eligibleNFTs.length} eligible)</span>
                <button className="select-all" onClick={selectAllNFTs}>Select All</button>
              </div>
              <div className="nft-list">
                {eligibleNFTs.map(nft => (
                  <label key={nft.tokenId} className={`nft-item ${selectedNFTs.includes(nft.tokenId) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedNFTs.includes(nft.tokenId)}
                      onChange={() => handleNFTToggle(nft.tokenId)}
                    />
                    <span className="nft-id">#{nft.tokenId}</span>
                    <span className="nft-power">{parseFloat(nft.power).toFixed(0)} power</span>
                  </label>
                ))}
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <button
              className="submit-vote"
              onClick={handleVote}
              disabled={voting || !selectedVote || selectedNFTs.length === 0}
            >
              {voting ? 'Submitting...' : `Vote with ${selectedNFTs.length} NFT${selectedNFTs.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {canVote && eligibleNFTs.length === 0 && (
          <div className="no-nfts-message">
            <p>You need wrapped voting NFTs to participate.</p>
            <p>Wrap your staked ANON NFTs to start voting!</p>
          </div>
        )}

        {!canVote && dispute.state === DisputeState.Active && (
          <div className="voting-ended">
            <p>Voting period has ended. Awaiting resolution.</p>
          </div>
        )}

        {dispute.state === DisputeState.Resolved && (
          <div className="resolution-result">
            <h4>Final Result</h4>
            <span className={`vote-${dispute.finalStatus}`}>
              {VOTE_LABELS[dispute.finalStatus]}
            </span>
          </div>
        )}
      </div>

      <div className="dispute-footer">
        <span className="disputer">
          Disputer: {dispute.disputer.slice(0, 6)}...{dispute.disputer.slice(-4)}
        </span>
        {eligibleNFTs.length > 0 && (
          <span className="your-power">Your Power: {totalPower.toFixed(0)}</span>
        )}
      </div>
    </div>
  );
}

