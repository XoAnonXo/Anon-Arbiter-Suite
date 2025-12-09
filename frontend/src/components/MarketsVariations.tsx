import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ethers } from 'ethers';
import { 
  TrendingUp, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  DollarSign,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  LayoutGrid,
  List,
  Table2,
  Layers,
  SplitSquareHorizontal,
  Grid3X3,
  Scale,
  Gavel,
  CircleDot,
  Gift,
  Vote,
  Users,
  Coins,
  AlertTriangle
} from 'lucide-react';
import type { Market } from '../hooks/useMarkets';
import type { UserNFT } from '../hooks/useUserNFTs';
import { MARKET_STATUS_LABELS, MarketStatus } from '../hooks/useMarkets';
import { SONIC_CHAIN, VoteOption, CONTRACTS, DISPUTE_RESOLVER_ABI, PROTOCOL_CONSTANTS } from '../config/contracts';
import { txToast } from './Toast';
import './MarketsVariations.css';

// Utility functions
function formatTokenAmount(amount: string, decimals: number, symbol: string): string {
  if (!amount || amount === '0') return `0 ${symbol}`;
  const formatted = ethers.utils.formatUnits(amount, decimals);
  const num = parseFloat(formatted);
  if (num >= 1000) {
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  }
  return `${formatted} ${symbol}`;
}

function calculatePayout(tvl: string, decimals: number, symbol: string): string {
  if (!tvl || tvl === '0') return `0 ${symbol}`;
  const tvlBN = ethers.BigNumber.from(tvl);
  // 0.8% = 8/1000
  const payout = tvlBN.mul(8).div(1000);
  const formatted = ethers.utils.formatUnits(payout, decimals);
  const num = parseFloat(formatted);
  if (num >= 1000) {
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  }
  return `${parseFloat(formatted).toFixed(2)} ${symbol}`;
}

// Calculate voter reward pool (80% of disputer deposit goes to voters)
function calculateVoterRewardPool(requiredCollateral: string, decimals: number, symbol: string): string {
  if (!requiredCollateral || requiredCollateral === '0') return `0 ${symbol}`;
  const depositBN = ethers.BigNumber.from(requiredCollateral);
  // 80% goes to voters (VOTERS_SHARE_BPS / BPS)
  const voterPool = depositBN.mul(PROTOCOL_CONSTANTS.VOTERS_SHARE_BPS).div(PROTOCOL_CONSTANTS.BPS);
  const formatted = ethers.utils.formatUnits(voterPool, decimals);
  const num = parseFloat(formatted);
  if (num >= 1000) {
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  }
  return `${parseFloat(formatted).toFixed(2)} ${symbol}`;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Shared types
interface MarketsVariationsProps {
  markets: Market[];
  userNFTs?: UserNFT[];
  onOpenDispute?: (pollAddress: string, marketAddress: string, collateralToken: string, status: number, reason: string) => void;
  onVote?: (pollAddress: string, status: number, tokenIds: string[]) => Promise<void>;
  onVoteSuccess?: () => void;
  openingDisputeFor?: string | null;
}

interface MarketItemProps {
  market: Market;
  userNFTs?: UserNFT[];
  onOpenDispute?: (pollAddress: string, marketAddress: string, collateralToken: string, status: number, reason: string) => void;
  onVote?: (pollAddress: string, status: number, tokenIds: string[]) => Promise<void>;
  onVoteSuccess?: () => void;
  isOpeningDispute?: boolean;
}

// Shared components
const StatusBadge = ({ market }: { market: Market }) => {
  if (market.arbitrationStarted) {
    return <span className="mv-badge mv-badge-arbitration"><Gavel size={12} /> In Arbitration</span>;
  }
  if (market.isFinalized) {
    return <span className="mv-badge mv-badge-finalized"><CheckCircle2 size={12} /> Resolved</span>;
  }
  return <span className="mv-badge mv-badge-active"><TrendingUp size={12} /> Active</span>;
};

const OutcomeBadge = ({ status }: { status: MarketStatus }) => {
  const classes: Record<MarketStatus, string> = {
    [MarketStatus.Pending]: 'mv-outcome-pending',
    [MarketStatus.Yes]: 'mv-outcome-yes',
    [MarketStatus.No]: 'mv-outcome-no',
    [MarketStatus.Unknown]: 'mv-outcome-unknown',
  };
  return (
    <span className={`mv-outcome ${classes[status]}`}>
      {MARKET_STATUS_LABELS[status]}
    </span>
  );
};

const DisputeForm = ({ market, onOpenDispute, isOpeningDispute, onClose }: {
  market: Market;
  onOpenDispute?: MarketItemProps['onOpenDispute'];
  isOpeningDispute?: boolean;
  onClose: () => void;
}) => {
  const [disputeStatus, setDisputeStatus] = useState<number>(VoteOption.No);
  const [disputeReason, setDisputeReason] = useState('');

  return (
    <motion.div 
      className="mv-dispute-form"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="mv-dispute-header">
        <span>Open Dispute</span>
        <button className="mv-close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="mv-collateral-notice">
        <DollarSign size={20} />
        <div>
          <span className="mv-collateral-label">Required Deposit</span>
          <span className="mv-collateral-amount">
            {formatTokenAmount(market.requiredCollateral, market.collateralDecimals, market.collateralSymbol)}
          </span>
        </div>
      </div>

      <div className="mv-form-field">
        <label>What should the outcome be?</label>
        <div className="mv-vote-options">
          {[
            { value: VoteOption.Yes, label: 'Yes' },
            { value: VoteOption.No, label: 'No' },
            { value: VoteOption.Unknown, label: 'Unknown' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`mv-vote-btn ${disputeStatus === opt.value ? 'selected' : ''}`}
              onClick={() => setDisputeStatus(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mv-form-field">
        <label>Reason for dispute</label>
        <textarea
          value={disputeReason}
          onChange={(e) => setDisputeReason(e.target.value)}
          placeholder="Explain why the current outcome is wrong..."
          maxLength={500}
        />
      </div>

      <div className="mv-form-actions">
        <button className="mv-cancel-btn" onClick={onClose} disabled={isOpeningDispute}>
          Cancel
        </button>
        <button
          className="mv-submit-btn"
          onClick={() => onOpenDispute?.(market.pollAddress, market.marketAddress, market.collateralToken, disputeStatus, disputeReason)}
          disabled={!disputeReason.trim() || isOpeningDispute}
        >
          {isOpeningDispute ? 'Opening...' : 'Deposit & Open'}
        </button>
      </div>
    </motion.div>
  );
};

// Voting Form for markets in arbitration
const VotingForm = ({ market, userNFTs, onClose, onVoteSuccess }: {
  market: Market;
  userNFTs?: UserNFT[];
  onClose: () => void;
  onVoteSuccess?: () => void;
}) => {
  const [selectedVote, setSelectedVote] = useState<number | null>(null);
  const [selectedNFTs, setSelectedNFTs] = useState<string[]>([]);
  const [voting, setVoting] = useState(false);

  // Filter for eligible NFTs (wrapped, can vote, not blocked)
  const eligibleNFTs = (userNFTs || []).filter(nft => nft.isWrapped && nft.canVote && !nft.isBlocked);
  const blockedNFTs = (userNFTs || []).filter(nft => nft.isWrapped && nft.isBlocked);
  const totalSelectedPower = eligibleNFTs
    .filter(nft => selectedNFTs.includes(nft.tokenId))
    .reduce((sum, nft) => sum + parseFloat(nft.power), 0);

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
    if (selectedVote === null || selectedNFTs.length === 0) {
      txToast.info('Selection Required', 'Please select a vote option and at least one NFT');
      return;
    }

    setVoting(true);
    const voteLabel = selectedVote === VoteOption.Yes ? 'Yes' : selectedVote === VoteOption.No ? 'No' : 'Unknown';
    const toastId = txToast.pending('Submitting Vote...', `Voting "${voteLabel}" with ${selectedNFTs.length} NFT(s)`);

    try {
      const provider = new ethers.providers.Web3Provider(window.ethereum as ethers.providers.ExternalProvider);
      const signer = provider.getSigner();
      const contract = new ethers.Contract(CONTRACTS.DISPUTE_RESOLVER_HOME, DISPUTE_RESOLVER_ABI, signer);

      const tx = await contract.vote(
        market.pollAddress,
        selectedVote,
        selectedNFTs.map(id => ethers.BigNumber.from(id))
      );

      txToast.pending('Submitting Vote...', 'Waiting for confirmation');
      await tx.wait();
      
      txToast.success(toastId, 'Vote Submitted!', `Voted "${voteLabel}" with ${selectedNFTs.length} NFT(s)`, tx.hash);
      onVoteSuccess?.();
      onClose();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Vote failed';
      txToast.error(toastId, 'Vote Failed', errorMessage);
    } finally {
      setVoting(false);
    }
  };

  return (
    <motion.div 
      className="mv-voting-form"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
    >
      <div className="mv-voting-header">
        <Vote size={18} />
        <span>Cast Your Vote</span>
        <button className="mv-close-btn" onClick={onClose}>×</button>
      </div>

      {/* Reward Pool Info */}
      <div className="mv-reward-pool-info">
        <div className="mv-reward-pool-icon">
          <Coins size={20} />
        </div>
        <div className="mv-reward-pool-content">
          <span className="mv-reward-pool-label">Voter Reward Pool</span>
          <span className="mv-reward-pool-amount">
            {calculateVoterRewardPool(market.requiredCollateral, market.collateralDecimals, market.collateralSymbol)}
          </span>
          <span className="mv-reward-pool-note">
            <Users size={12} /> All voters share 80% of disputer's deposit
          </span>
        </div>
      </div>

      {/* Vote Options */}
      <div className="mv-form-field">
        <label>What should the outcome be?</label>
        <div className="mv-vote-options">
          {[
            { value: VoteOption.Yes, label: 'Yes', color: 'yes' },
            { value: VoteOption.No, label: 'No', color: 'no' },
            { value: VoteOption.Unknown, label: 'Unknown', color: 'unknown' },
          ].map(opt => (
            <button
              key={opt.value}
              className={`mv-vote-btn mv-vote-${opt.color} ${selectedVote === opt.value ? 'selected' : ''}`}
              onClick={() => setSelectedVote(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* NFT Selection */}
      {eligibleNFTs.length > 0 ? (
        <div className="mv-nft-selection">
          <div className="mv-nft-header">
            <span>Select NFTs to Vote With ({eligibleNFTs.length} eligible)</span>
            <button className="mv-select-all" onClick={selectAllNFTs}>Select All</button>
          </div>
          <div className="mv-nft-list">
            {eligibleNFTs.map(nft => (
              <label 
                key={nft.tokenId} 
                className={`mv-nft-item ${selectedNFTs.includes(nft.tokenId) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedNFTs.includes(nft.tokenId)}
                  onChange={() => handleNFTToggle(nft.tokenId)}
                />
                <span className="mv-nft-id">#{nft.tokenId}</span>
                <span className="mv-nft-power">{parseFloat(nft.power).toFixed(0)} power</span>
              </label>
            ))}
          </div>
          {selectedNFTs.length > 0 && (
            <div className="mv-selected-power">
              Total Voting Power: <strong>{totalSelectedPower.toFixed(0)}</strong>
            </div>
          )}
        </div>
      ) : (
        <div className="mv-no-nfts-message">
          <AlertTriangle size={20} />
          <p>You need wrapped voting NFTs to participate.</p>
          <p>Wrap your staked ANON NFTs in the "My NFTs" section to start voting!</p>
        </div>
      )}

      {/* Blocked NFTs Warning */}
      {blockedNFTs.length > 0 && (
        <div className="mv-blocked-nfts-warning">
          <AlertTriangle size={16} />
          <span>{blockedNFTs.length} NFT(s) blocked due to penalties</span>
        </div>
      )}

      {/* Submit Button */}
      <div className="mv-form-actions">
        <button className="mv-cancel-btn" onClick={onClose} disabled={voting}>
          Cancel
        </button>
        <button
          className="mv-submit-btn mv-vote-submit"
          onClick={handleVote}
          disabled={voting || selectedVote === null || selectedNFTs.length === 0}
        >
          {voting ? 'Voting...' : `Vote with ${selectedNFTs.length} NFT${selectedNFTs.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </motion.div>
  );
};

// ============================================
// VARIATION 1: Default Grid (Enhanced)
// ============================================
export const Variation1Grid = ({ markets, onOpenDispute, openingDisputeFor }: MarketsVariationsProps) => {
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState<string | null>(null);
  const explorerUrl = `${SONIC_CHAIN.blockExplorers.default.url}/address`;

  return (
    <div className="mv1-grid">
      {markets.map((market, index) => (
        <motion.div
          key={`${market.pollAddress}-${market.marketAddress}`}
          className={`mv1-card ${market.arbitrationStarted ? 'arbitration' : ''}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <div className="mv1-header">
            <StatusBadge market={market} />
            <div className="mv1-badges">
              {market.isOurArbiter && <span className="mv1-arbiter-badge">Our Arbiter</span>}
              <span className="mv1-type-badge">{market.marketType === 'pari' ? 'Pari' : 'AMM'}</span>
            </div>
          </div>

          <h3 className="mv1-question">
            {market.question || `Market ${truncateAddress(market.pollAddress)}`}
          </h3>
          
          {market.description && (
            <p className="mv1-description">{market.description}</p>
          )}

          <div className="mv1-stats">
            <div className="mv1-stat">
              <span className="mv1-stat-label">Outcome</span>
              <OutcomeBadge status={market.status} />
            </div>
            {market.tvl && market.tvl !== '0' && (
              <div className="mv1-stat">
                <span className="mv1-stat-label">TVL</span>
                <span className="mv1-stat-value">
                  {formatTokenAmount(market.tvl, market.collateralDecimals, market.collateralSymbol)}
                </span>
              </div>
            )}
          </div>

          {market.resolutionReason && (
            <div className="mv1-reasoning">
              <div className="mv1-reasoning-header">
                <span>🤖</span> AI Resolution
              </div>
              <p>{market.resolutionReason}</p>
            </div>
          )}

          {!market.isFinalized && market.isOurArbiter && (
            <div className="mv1-actions">
              {market.arbitrationStarted ? (
                <span className="mv1-arbitration-notice">
                  <Scale size={16} /> Dispute in progress
                </span>
              ) : showDisputeForm === market.pollAddress ? (
                <AnimatePresence>
                  <DisputeForm
                    market={market}
                    onOpenDispute={onOpenDispute}
                    isOpeningDispute={openingDisputeFor === market.pollAddress}
                    onClose={() => setShowDisputeForm(null)}
                  />
                </AnimatePresence>
              ) : (
                <button 
                  className="mv1-dispute-btn"
                  onClick={() => setShowDisputeForm(market.pollAddress)}
                >
                  Open Dispute
                </button>
              )}
            </div>
          )}

          {market.rules && (
            <div className="mv1-rules-section">
              <button 
                className="mv1-rules-toggle"
                onClick={() => setExpandedCard(expandedCard === market.pollAddress ? null : market.pollAddress)}
              >
                {expandedCard === market.pollAddress ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                {expandedCard === market.pollAddress ? 'Hide Rules' : 'Show Rules'}
              </button>
              <AnimatePresence>
                {expandedCard === market.pollAddress && (
                  <motion.div
                    className="mv1-rules"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <p>{market.rules}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          <div className="mv1-footer">
            <a href={`${explorerUrl}/${market.pollAddress}`} target="_blank" rel="noopener noreferrer">
              Poll <ExternalLink size={10} />
            </a>
            <span>•</span>
            <a href={`${explorerUrl}/${market.marketAddress}`} target="_blank" rel="noopener noreferrer">
              Market <ExternalLink size={10} />
            </a>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// VARIATION 2: Table View
// ============================================
export const Variation2Table = ({ markets, onOpenDispute, openingDisputeFor }: MarketsVariationsProps) => {
  const [sortField, setSortField] = useState<'status' | 'tvl' | 'outcome'>('status');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [showDisputeForm, setShowDisputeForm] = useState<string | null>(null);
  const explorerUrl = `${SONIC_CHAIN.blockExplorers.default.url}/address`;

  const sortedMarkets = [...markets].sort((a, b) => {
    let comparison = 0;
    if (sortField === 'status') {
      const statusOrder = (m: Market) => m.arbitrationStarted ? 2 : m.isFinalized ? 0 : 1;
      comparison = statusOrder(b) - statusOrder(a);
    } else if (sortField === 'tvl') {
      comparison = parseFloat(b.tvl || '0') - parseFloat(a.tvl || '0');
    } else if (sortField === 'outcome') {
      comparison = a.status - b.status;
    }
    return sortDir === 'asc' ? -comparison : comparison;
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className="mv2-table-container">
      <table className="mv2-table">
        <thead>
          <tr>
            <th className="mv2-th-question">Market</th>
            <th className="mv2-th-sortable" onClick={() => handleSort('status')}>
              Status {sortField === 'status' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
            <th className="mv2-th-sortable" onClick={() => handleSort('outcome')}>
              Outcome {sortField === 'outcome' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
            <th className="mv2-th-sortable" onClick={() => handleSort('tvl')}>
              TVL {sortField === 'tvl' && (sortDir === 'asc' ? '↑' : '↓')}
            </th>
            <th>Type</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedMarkets.map((market, index) => (
            <>
              <motion.tr
                key={market.pollAddress}
                className={`mv2-row ${market.arbitrationStarted ? 'arbitration' : ''}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                onClick={() => setExpandedRow(expandedRow === market.pollAddress ? null : market.pollAddress)}
              >
                <td className="mv2-td-question">
                  <div className="mv2-question-cell">
                    <span className="mv2-question-text">
                      {market.question || truncateAddress(market.pollAddress)}
                    </span>
                    {market.isOurArbiter && <span className="mv2-mini-badge">Arbiter</span>}
                  </div>
                </td>
                <td><StatusBadge market={market} /></td>
                <td><OutcomeBadge status={market.status} /></td>
                <td className="mv2-td-tvl">
                  {market.tvl && market.tvl !== '0' 
                    ? formatTokenAmount(market.tvl, market.collateralDecimals, market.collateralSymbol)
                    : '-'
                  }
                </td>
                <td>
                  <span className="mv2-type">{market.marketType === 'pari' ? 'Pari' : 'AMM'}</span>
                </td>
                <td className="mv2-td-actions">
                  {!market.isFinalized && market.isOurArbiter && !market.arbitrationStarted && (
                    <button 
                      className="mv2-action-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDisputeForm(showDisputeForm === market.pollAddress ? null : market.pollAddress);
                      }}
                    >
                      Dispute
                    </button>
                  )}
                  <a 
                    href={`${explorerUrl}/${market.pollAddress}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    className="mv2-link-btn"
                  >
                    <ExternalLink size={14} />
                  </a>
                </td>
              </motion.tr>
              {(expandedRow === market.pollAddress || showDisputeForm === market.pollAddress) && (
                <tr className="mv2-expanded-row">
                  <td colSpan={6}>
                    <div className="mv2-expanded-content">
                      {showDisputeForm === market.pollAddress ? (
                        <DisputeForm
                          market={market}
                          onOpenDispute={onOpenDispute}
                          isOpeningDispute={openingDisputeFor === market.pollAddress}
                          onClose={() => setShowDisputeForm(null)}
                        />
                      ) : (
                        <>
                          {market.description && <p className="mv2-description">{market.description}</p>}
                          {market.resolutionReason && (
                            <div className="mv2-reasoning">
                              <strong>🤖 AI Resolution:</strong> {market.resolutionReason}
                            </div>
                          )}
                          {market.rules && (
                            <div className="mv2-rules">
                              <strong>Rules:</strong> {market.rules}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// ============================================
// VARIATION 3: Compact Cards
// ============================================
export const Variation3Compact = ({ markets, onOpenDispute, openingDisputeFor }: MarketsVariationsProps) => {
  const [activeDispute, setActiveDispute] = useState<string | null>(null);
  const explorerUrl = `${SONIC_CHAIN.blockExplorers.default.url}/address`;

  return (
    <div className="mv3-compact-grid">
      {markets.map((market, index) => (
        <motion.div
          key={`${market.pollAddress}-${market.marketAddress}`}
          className={`mv3-card ${market.arbitrationStarted ? 'arbitration' : ''} ${market.isFinalized ? 'finalized' : ''}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: index * 0.03 }}
        >
          <div className="mv3-top-row">
            <StatusBadge market={market} />
            <span className="mv3-type">{market.marketType === 'pari' ? 'P' : 'A'}</span>
          </div>

          <h4 className="mv3-question">
            {market.question || truncateAddress(market.pollAddress)}
          </h4>

          <div className="mv3-meta">
            <div className="mv3-outcome-row">
              <OutcomeBadge status={market.status} />
              {market.tvl && market.tvl !== '0' && (
                <span className="mv3-tvl">
                  <DollarSign size={12} />
                  {formatTokenAmount(market.tvl, market.collateralDecimals, market.collateralSymbol)}
                </span>
              )}
            </div>
          </div>

          {activeDispute === market.pollAddress ? (
            <DisputeForm
              market={market}
              onOpenDispute={onOpenDispute}
              isOpeningDispute={openingDisputeFor === market.pollAddress}
              onClose={() => setActiveDispute(null)}
            />
          ) : (
            <div className="mv3-actions">
              {!market.isFinalized && market.isOurArbiter && !market.arbitrationStarted && (
                <button 
                  className="mv3-dispute-btn"
                  onClick={() => setActiveDispute(market.pollAddress)}
                >
                  Dispute
                </button>
              )}
              <a 
                href={`${explorerUrl}/${market.pollAddress}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mv3-explorer-btn"
              >
                <ExternalLink size={14} />
              </a>
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// VARIATION 4: List View
// ============================================
export const Variation4List = ({ markets, userNFTs, onOpenDispute, onVoteSuccess, openingDisputeFor }: MarketsVariationsProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [disputeFormId, setDisputeFormId] = useState<string | null>(null);
  const [votingFormId, setVotingFormId] = useState<string | null>(null);
  const explorerUrl = `${SONIC_CHAIN.blockExplorers.default.url}/address`;

  return (
    <div className="mv4-list">
      {markets.map((market, index) => (
        <motion.div
          key={`${market.pollAddress}-${market.marketAddress}`}
          className={`mv4-item ${market.arbitrationStarted ? 'arbitration' : ''}`}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.04 }}
        >
          <div className="mv4-main">
            <div className="mv4-indicator">
              {market.arbitrationStarted ? (
                <Gavel size={20} className="mv4-icon-arbitration" />
              ) : market.isFinalized ? (
                <CheckCircle2 size={20} className="mv4-icon-finalized" />
              ) : (
                <CircleDot size={20} className="mv4-icon-active" />
              )}
            </div>

            <div className="mv4-content">
              <div className="mv4-header">
                <h4 className="mv4-question">
                  {market.question || `Market ${truncateAddress(market.pollAddress)}`}
                </h4>
                <div className="mv4-badges">
                  {market.isOurArbiter && <span className="mv4-arbiter">Arbiter</span>}
                  <span className="mv4-type">{market.marketType === 'pari' ? 'PariMutuel' : 'AMM'}</span>
                </div>
              </div>

              <div className="mv4-stats-row">
                <div className="mv4-stat">
                  <span className="mv4-stat-label">Status</span>
                  <StatusBadge market={market} />
                </div>
                <div className="mv4-stat">
                  <span className="mv4-stat-label">Outcome</span>
                  <OutcomeBadge status={market.status} />
                </div>
                {market.tvl && market.tvl !== '0' && (
                  <>
                    <div className="mv4-stat">
                      <span className="mv4-stat-label">TVL</span>
                      <span className="mv4-stat-value">
                        {formatTokenAmount(market.tvl, market.collateralDecimals, market.collateralSymbol)}
                      </span>
                    </div>
                    <motion.div 
                      className="mv4-stat mv4-stat-payout"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 }}
                    >
                      <span className="mv4-stat-label">
                        <Gift size={12} /> Payout
                      </span>
                      <span className="mv4-stat-value mv4-payout-value">
                        {calculatePayout(market.tvl, market.collateralDecimals, market.collateralSymbol)}
                      </span>
                    </motion.div>
                  </>
                )}
              </div>

              {(expandedId === market.pollAddress || disputeFormId === market.pollAddress || votingFormId === market.pollAddress) && (
                <motion.div
                  className="mv4-expanded"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                >
                  {disputeFormId === market.pollAddress ? (
                    <DisputeForm
                      market={market}
                      onOpenDispute={onOpenDispute}
                      isOpeningDispute={openingDisputeFor === market.pollAddress}
                      onClose={() => setDisputeFormId(null)}
                    />
                  ) : votingFormId === market.pollAddress ? (
                    <VotingForm
                      market={market}
                      userNFTs={userNFTs}
                      onClose={() => setVotingFormId(null)}
                      onVoteSuccess={onVoteSuccess}
                    />
                  ) : (
                    <>
                      {market.description && <p className="mv4-description">{market.description}</p>}
                      {market.arbitrationStarted && (
                        <div className="mv4-reward-banner">
                          <Coins size={16} />
                          <span>Reward Pool: {calculateVoterRewardPool(market.requiredCollateral, market.collateralDecimals, market.collateralSymbol)}</span>
                          <span className="mv4-reward-note">(80% shared among voters)</span>
                        </div>
                      )}
                      {market.resolutionReason && (
                        <div className="mv4-reasoning">
                          <span className="mv4-reasoning-icon">🤖</span>
                          <div>
                            <strong>AI Resolution</strong>
                            <p>{market.resolutionReason}</p>
                          </div>
                        </div>
                      )}
                      {market.rules && (
                        <div className="mv4-rules">
                          <strong>Rules:</strong>
                          <p>{market.rules}</p>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}
            </div>

            <div className="mv4-actions">
              {!market.isFinalized && market.isOurArbiter && (
                market.arbitrationStarted ? (
                  <button 
                    className="mv4-btn mv4-btn-vote"
                    onClick={() => setVotingFormId(votingFormId === market.pollAddress ? null : market.pollAddress)}
                  >
                    <Vote size={16} />
                    Vote
                  </button>
                ) : (
                  <button 
                    className="mv4-btn mv4-btn-dispute"
                    onClick={() => setDisputeFormId(disputeFormId === market.pollAddress ? null : market.pollAddress)}
                  >
                    <AlertCircle size={16} />
                    Dispute
                  </button>
                )
              )}
              <button 
                className="mv4-btn mv4-btn-expand"
                onClick={() => setExpandedId(expandedId === market.pollAddress ? null : market.pollAddress)}
              >
                {expandedId === market.pollAddress ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <a 
                href={`${explorerUrl}/${market.pollAddress}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mv4-btn mv4-btn-link"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
};

// ============================================
// VARIATION 5: Kanban Board
// ============================================
export const Variation5Kanban = ({ markets, onOpenDispute, openingDisputeFor }: MarketsVariationsProps) => {
  const [activeDispute, setActiveDispute] = useState<string | null>(null);
  
  const activeMarkets = markets.filter(m => !m.isFinalized && !m.arbitrationStarted);
  const arbitrationMarkets = markets.filter(m => m.arbitrationStarted);
  const resolvedMarkets = markets.filter(m => m.isFinalized);

  const KanbanCard = ({ market, index }: { market: Market; index: number }) => (
    <motion.div
      className="mv5-card"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
    >
      <div className="mv5-card-header">
        <span className="mv5-type">{market.marketType === 'pari' ? 'P' : 'A'}</span>
        {market.isOurArbiter && <span className="mv5-arbiter">⚖️</span>}
      </div>
      <h5 className="mv5-question">
        {market.question || truncateAddress(market.pollAddress)}
      </h5>
      <div className="mv5-card-meta">
        <OutcomeBadge status={market.status} />
        {market.tvl && market.tvl !== '0' && (
          <span className="mv5-tvl">
            {formatTokenAmount(market.tvl, market.collateralDecimals, market.collateralSymbol)}
          </span>
        )}
      </div>
      {activeDispute === market.pollAddress ? (
        <DisputeForm
          market={market}
          onOpenDispute={onOpenDispute}
          isOpeningDispute={openingDisputeFor === market.pollAddress}
          onClose={() => setActiveDispute(null)}
        />
      ) : (
        !market.isFinalized && market.isOurArbiter && !market.arbitrationStarted && (
          <button 
            className="mv5-dispute-btn"
            onClick={() => setActiveDispute(market.pollAddress)}
          >
            Open Dispute
          </button>
        )
      )}
    </motion.div>
  );

  return (
    <div className="mv5-kanban">
      <div className="mv5-column mv5-column-active">
        <div className="mv5-column-header">
          <TrendingUp size={18} />
          <span>Active</span>
          <span className="mv5-count">{activeMarkets.length}</span>
        </div>
        <div className="mv5-column-content">
          {activeMarkets.map((market, index) => (
            <KanbanCard key={market.pollAddress} market={market} index={index} />
          ))}
          {activeMarkets.length === 0 && (
            <div className="mv5-empty">No active markets</div>
          )}
        </div>
      </div>

      <div className="mv5-column mv5-column-arbitration">
        <div className="mv5-column-header">
          <Gavel size={18} />
          <span>In Arbitration</span>
          <span className="mv5-count">{arbitrationMarkets.length}</span>
        </div>
        <div className="mv5-column-content">
          {arbitrationMarkets.map((market, index) => (
            <KanbanCard key={market.pollAddress} market={market} index={index} />
          ))}
          {arbitrationMarkets.length === 0 && (
            <div className="mv5-empty">No markets in arbitration</div>
          )}
        </div>
      </div>

      <div className="mv5-column mv5-column-resolved">
        <div className="mv5-column-header">
          <CheckCircle2 size={18} />
          <span>Resolved</span>
          <span className="mv5-count">{resolvedMarkets.length}</span>
        </div>
        <div className="mv5-column-content">
          {resolvedMarkets.map((market, index) => (
            <KanbanCard key={market.pollAddress} market={market} index={index} />
          ))}
          {resolvedMarkets.length === 0 && (
            <div className="mv5-empty">No resolved markets</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================
// VARIATION 6: Split View (Featured + List)
// ============================================
export const Variation6Split = ({ markets, userNFTs, onOpenDispute, onVoteSuccess, openingDisputeFor }: MarketsVariationsProps) => {
  const [selectedMarket, setSelectedMarket] = useState<Market | null>(markets[0] || null);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [showVotingForm, setShowVotingForm] = useState(false);
  const explorerUrl = `${SONIC_CHAIN.blockExplorers.default.url}/address`;

  return (
    <div className="mv6-split">
      {/* Left: Market List */}
      <div className="mv6-sidebar">
        <div className="mv6-sidebar-header">
          <h4>All Markets ({markets.length})</h4>
        </div>
        <div className="mv6-market-list">
          {markets.map((market, index) => (
            <motion.button
              key={market.pollAddress}
              className={`mv6-market-item ${selectedMarket?.pollAddress === market.pollAddress ? 'selected' : ''} ${market.arbitrationStarted ? 'arbitration' : ''}`}
              onClick={() => {
                setSelectedMarket(market);
                setShowDisputeForm(false);
                setShowVotingForm(false);
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <div className="mv6-item-indicator">
                {market.arbitrationStarted ? (
                  <Gavel size={14} className="icon-arbitration" />
                ) : market.isFinalized ? (
                  <CheckCircle2 size={14} className="icon-finalized" />
                ) : (
                  <CircleDot size={14} className="icon-active" />
                )}
              </div>
              <div className="mv6-item-content">
                <span className="mv6-item-question">
                  {market.question || truncateAddress(market.pollAddress)}
                </span>
                <div className="mv6-item-meta">
                  <OutcomeBadge status={market.status} />
                  <span className="mv6-item-type">{market.marketType}</span>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Right: Selected Market Details */}
      <div className="mv6-detail">
        {selectedMarket ? (
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMarket.pollAddress}
              className="mv6-detail-content"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="mv6-detail-header">
                <StatusBadge market={selectedMarket} />
                <div className="mv6-detail-badges">
                  {selectedMarket.isOurArbiter && <span className="mv6-arbiter-badge">Our Arbiter</span>}
                  <span className="mv6-type-badge">{selectedMarket.marketType === 'pari' ? 'PariMutuel' : 'AMM'}</span>
                </div>
              </div>

              <h2 className="mv6-detail-question">
                {selectedMarket.question || `Market ${truncateAddress(selectedMarket.pollAddress)}`}
              </h2>

              {selectedMarket.description && (
                <p className="mv6-detail-description">{selectedMarket.description}</p>
              )}

              <div className="mv6-detail-stats">
                <div className="mv6-stat-card">
                  <span className="mv6-stat-label">Current Outcome</span>
                  <OutcomeBadge status={selectedMarket.status} />
                </div>
                <div className="mv6-stat-card">
                  <span className="mv6-stat-label">Finalized</span>
                  <span className={`mv6-stat-value ${selectedMarket.isFinalized ? 'yes' : 'no'}`}>
                    {selectedMarket.isFinalized ? 'Yes' : 'No'}
                  </span>
                </div>
                {selectedMarket.tvl && selectedMarket.tvl !== '0' && (
                  <>
                    <div className="mv6-stat-card">
                      <span className="mv6-stat-label">TVL</span>
                      <span className="mv6-stat-value tvl">
                        {formatTokenAmount(selectedMarket.tvl, selectedMarket.collateralDecimals, selectedMarket.collateralSymbol)}
                      </span>
                    </div>
                    <motion.div 
                      className="mv6-stat-card mv6-payout-card"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                    >
                      <span className="mv6-stat-label">
                        <Gift size={14} /> Total Payout
                      </span>
                      <span className="mv6-stat-value payout">
                        {calculatePayout(selectedMarket.tvl, selectedMarket.collateralDecimals, selectedMarket.collateralSymbol)}
                      </span>
                    </motion.div>
                  </>
                )}
              </div>

              {selectedMarket.resolutionReason && (
                <div className="mv6-reasoning-section">
                  <div className="mv6-reasoning-header">
                    <span>🤖</span>
                    <span>AI Resolution Reasoning</span>
                  </div>
                  <p>{selectedMarket.resolutionReason}</p>
                </div>
              )}

              {selectedMarket.rules && (
                <div className="mv6-rules-section">
                  <h5>Market Rules</h5>
                  <p>{selectedMarket.rules}</p>
                </div>
              )}

              {showDisputeForm ? (
                <DisputeForm
                  market={selectedMarket}
                  onOpenDispute={onOpenDispute}
                  isOpeningDispute={openingDisputeFor === selectedMarket.pollAddress}
                  onClose={() => setShowDisputeForm(false)}
                />
              ) : showVotingForm ? (
                <VotingForm
                  market={selectedMarket}
                  userNFTs={userNFTs}
                  onClose={() => setShowVotingForm(false)}
                  onVoteSuccess={onVoteSuccess}
                />
              ) : (
                <div className="mv6-detail-actions">
                  {!selectedMarket.isFinalized && selectedMarket.isOurArbiter && (
                    selectedMarket.arbitrationStarted ? (
                      <>
                        <div className="mv6-arbitration-notice">
                          <Scale size={20} />
                          <span>Dispute in progress - Vote to earn rewards!</span>
                        </div>
                        <div className="mv6-reward-pool-banner">
                          <Coins size={16} />
                          <span>Reward Pool: {calculateVoterRewardPool(selectedMarket.requiredCollateral, selectedMarket.collateralDecimals, selectedMarket.collateralSymbol)}</span>
                          <span className="mv6-reward-note">(80% of deposit shared among all voters)</span>
                        </div>
                        <button 
                          className="mv6-vote-btn"
                          onClick={() => setShowVotingForm(true)}
                        >
                          <Vote size={18} />
                          Cast Your Vote
                        </button>
                      </>
                    ) : (
                      <button 
                        className="mv6-dispute-btn"
                        onClick={() => setShowDisputeForm(true)}
                      >
                        <AlertCircle size={18} />
                        Open Dispute
                      </button>
                    )
                  )}
                  <a 
                    href={`${explorerUrl}/${selectedMarket.pollAddress}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mv6-explorer-btn"
                  >
                    View on Explorer <ExternalLink size={14} />
                  </a>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        ) : (
          <div className="mv6-no-selection">
            <Layers size={48} />
            <p>Select a market to view details</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================
// PREVIEW COMPONENT - Shows selected variations
// ============================================
export const MarketsVariations = ({ markets, userNFTs, onOpenDispute, onVoteSuccess, openingDisputeFor }: MarketsVariationsProps) => {
  const [selectedVariation, setSelectedVariation] = useState(6);

  const variations = [
    { id: 4, name: "List", icon: List, component: Variation4List },
    { id: 6, name: "Split", icon: SplitSquareHorizontal, component: Variation6Split },
  ];

  const SelectedComponent = variations.find(v => v.id === selectedVariation)?.component || Variation6Split;

  return (
    <div className="markets-variations-preview">
      <div className="markets-variations-selector">
        <span className="selector-label">Layout:</span>
        <div className="selector-buttons">
          {variations.map(v => {
            const Icon = v.icon;
            return (
              <button
                key={v.id}
                className={`selector-btn ${selectedVariation === v.id ? 'active' : ''}`}
                onClick={() => setSelectedVariation(v.id)}
                title={v.name}
              >
                <Icon size={16} />
                <span>{v.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      
      <div className="markets-variation-content">
        <SelectedComponent 
          markets={markets} 
          userNFTs={userNFTs}
          onOpenDispute={onOpenDispute}
          onVoteSuccess={onVoteSuccess}
          openingDisputeFor={openingDisputeFor}
        />
      </div>
    </div>
  );
};

export default MarketsVariations;
