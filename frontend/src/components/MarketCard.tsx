import { useState } from 'react';
import { ethers } from 'ethers';
import type { Market } from '../hooks/useMarkets';
import { MARKET_STATUS_LABELS, MarketStatus } from '../hooks/useMarkets';
import { SONIC_CHAIN, VoteOption } from '../config/contracts';
import './MarketCard.css';

/**
 * Format a token amount for display
 */
function formatTokenAmount(amount: string, decimals: number, symbol: string): string {
  if (!amount || amount === '0') return `0 ${symbol}`;
  const formatted = ethers.utils.formatUnits(amount, decimals);
  // Format with commas and up to 2 decimal places
  const num = parseFloat(formatted);
  if (num >= 1000) {
    return `${num.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${symbol}`;
  }
  return `${formatted} ${symbol}`;
}

interface MarketCardProps {
  market: Market;
  onOpenDispute?: (pollAddress: string, marketAddress: string, collateralToken: string, status: number, reason: string) => void;
  isOpeningDispute?: boolean;
}

export function MarketCard({ market, onOpenDispute, isOpeningDispute }: MarketCardProps) {
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [disputeStatus, setDisputeStatus] = useState<number>(VoteOption.No);
  const [disputeReason, setDisputeReason] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusBadgeClass = () => {
    if (market.arbitrationStarted) return 'status-arbitration';
    if (market.isFinalized) return 'status-finalized';
    return 'status-active';
  };

  const getStatusText = () => {
    if (market.arbitrationStarted) return 'In Arbitration';
    if (market.isFinalized) return 'Resolved';
    return 'Active';
  };

  const getOutcomeClass = (status: MarketStatus) => {
    switch (status) {
      case MarketStatus.Yes: return 'outcome-yes';
      case MarketStatus.No: return 'outcome-no';
      case MarketStatus.Unknown: return 'outcome-unknown';
      default: return 'outcome-pending';
    }
  };

  const explorerUrl = `${SONIC_CHAIN.blockExplorers.default.url}/address`;

  return (
    <div className={`market-card ${market.arbitrationStarted ? 'in-arbitration' : ''} ${isExpanded ? 'expanded' : ''}`}>
      <div className="market-header">
        <span className={`status-badge ${getStatusBadgeClass()}`}>
          {getStatusText()}
        </span>
        <div className="header-badges">
          {market.isOurArbiter && (
            <span className="our-arbiter-badge">Our Arbiter</span>
          )}
          <span className="market-type-badge">
            {market.marketType === 'pari' ? 'PariMutuel' : 'AMM'}
          </span>
        </div>
      </div>

      <div className="market-body">
        {/* Question Section */}
        <div className="market-question-section">
          <h3 className="market-question">
            {market.question || `Market ${market.pollAddress.slice(0, 8)}...${market.pollAddress.slice(-6)}`}
          </h3>
          {market.description && (
            <p className="market-description">{market.description}</p>
          )}
        </div>

        {/* AI Resolution Reasoning - shown for resolved markets */}
        {market.resolutionReason && (
          <div className="resolution-reasoning-section">
            <div className="resolution-reasoning-header">
              <span className="ai-icon">🤖</span>
              <span className="resolution-reasoning-title">AI Resolution Reasoning</span>
            </div>
            <div className="resolution-reasoning-content">
              {market.resolutionReason}
            </div>
          </div>
        )}

        <div className="market-status-section">
          <div className="status-row">
            <span className="status-label">Current Outcome:</span>
            <span className={`outcome-value ${getOutcomeClass(market.status)}`}>
              {MARKET_STATUS_LABELS[market.status]}
            </span>
          </div>
          <div className="status-row">
            <span className="status-label">Finalized:</span>
            <span className={`status-value ${market.isFinalized ? 'finalized' : 'not-finalized'}`}>
              {market.isFinalized ? 'Yes' : 'No'}
            </span>
          </div>
          {market.tvl && market.tvl !== '0' && (
            <div className="status-row">
              <span className="status-label">TVL:</span>
              <span className="status-value tvl-value">
                {formatTokenAmount(market.tvl, market.collateralDecimals, market.collateralSymbol)}
              </span>
            </div>
          )}
        </div>

        {!market.isFinalized && market.isOurArbiter && (
          <div className="market-actions">
            {market.arbitrationStarted ? (
              <span className="arbitration-notice">
                ⚖️ Dispute resolution in progress
              </span>
            ) : showDisputeForm ? (
              <div className="dispute-form">
                <div className="dispute-form-header">
                  <span>Open Dispute</span>
                  <button 
                    className="close-form-btn"
                    onClick={() => setShowDisputeForm(false)}
                  >
                    ✕
                  </button>
                </div>

                {/* Collateral Requirement Notice */}
                <div className="collateral-notice">
                  <div className="collateral-notice-icon">💰</div>
                  <div className="collateral-notice-content">
                    <div className="collateral-notice-title">Collateral Required</div>
                    <div className="collateral-notice-amount">
                      {formatTokenAmount(market.requiredCollateral, market.collateralDecimals, market.collateralSymbol)}
                    </div>
                    <div className="collateral-notice-info">
                      1% of TVL (refunded if dispute succeeds)
                    </div>
                  </div>
                </div>

                <div className="dispute-form-field">
                  <label>What should the outcome be?</label>
                  <div className="dispute-status-options">
                    <button 
                      className={`status-option ${disputeStatus === VoteOption.Yes ? 'selected' : ''}`}
                      onClick={() => setDisputeStatus(VoteOption.Yes)}
                    >
                      Yes
                    </button>
                    <button 
                      className={`status-option ${disputeStatus === VoteOption.No ? 'selected' : ''}`}
                      onClick={() => setDisputeStatus(VoteOption.No)}
                    >
                      No
                    </button>
                    <button 
                      className={`status-option ${disputeStatus === VoteOption.Unknown ? 'selected' : ''}`}
                      onClick={() => setDisputeStatus(VoteOption.Unknown)}
                    >
                      Unknown
                    </button>
                  </div>
                </div>
                <div className="dispute-form-field">
                  <label>Reason for dispute</label>
                  <textarea
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    placeholder="Explain why the current outcome is wrong..."
                    maxLength={500}
                  />
                </div>
                <div className="dispute-form-actions">
                  <button 
                    className="cancel-btn"
                    onClick={() => setShowDisputeForm(false)}
                    disabled={isOpeningDispute}
                  >
                    Cancel
                  </button>
                  <button 
                    className="submit-dispute-btn"
                    onClick={() => {
                      onOpenDispute?.(market.pollAddress, market.marketAddress, market.collateralToken, disputeStatus, disputeReason);
                    }}
                    disabled={!disputeReason.trim() || isOpeningDispute}
                  >
                    {isOpeningDispute ? 'Opening...' : `Deposit & Open Dispute`}
                  </button>
                </div>
              </div>
            ) : (
              <button 
                className="dispute-button"
                onClick={() => setShowDisputeForm(true)}
              >
                Open Dispute
              </button>
            )}
          </div>
        )}

        {market.isFinalized && (
          <div className="resolution-info">
            <span className="resolution-icon">✓</span>
            <span>Market resolved with outcome: <strong>{MARKET_STATUS_LABELS[market.status]}</strong></span>
          </div>
        )}

        {/* Expandable Rules Section */}
        {market.rules && (
          <div className="market-rules-section">
            <button 
              className="rules-toggle"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? '▼ Hide Rules' : '▶ Show Rules'}
            </button>
            {isExpanded && (
              <div className="market-rules">
                <p>{market.rules}</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="market-footer">
        <div className="footer-addresses">
          <a 
            href={`${explorerUrl}/${market.pollAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Poll: {market.pollAddress.slice(0, 6)}...{market.pollAddress.slice(-4)}
          </a>
          <span className="footer-separator">•</span>
          <a 
            href={`${explorerUrl}/${market.marketAddress}`}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            Market: {market.marketAddress.slice(0, 6)}...{market.marketAddress.slice(-4)}
          </a>
        </div>
      </div>
    </div>
  );
}
