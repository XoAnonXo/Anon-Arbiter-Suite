import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NFTManager } from '../NFTManager';
import type { UserNFT } from '../../hooks/useUserNFTs';

describe('NFTManager', () => {
  const mockOnUpdate = vi.fn();

  const mockWrappedNFT: UserNFT = {
    tokenId: '1',
    power: '1000',
    isWrapped: true,
    canVote: true,
    voteDisabledUntil: 0,
    unstakeAvailableAt: 0,
    validTo: 0,
  };

  const mockUnwrappedNFT: UserNFT = {
    tokenId: '2',
    power: '500',
    isWrapped: false,
    canVote: false,
    voteDisabledUntil: 0,
    unstakeAvailableAt: 0,
    validTo: 0,
  };

  beforeEach(() => {
    mockOnUpdate.mockClear();
  });

  it('renders "Your Voting NFTs" header', () => {
    render(
      <NFTManager 
        wrappedNFTs={[]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    expect(screen.getByText('Your Voting NFTs')).toBeInTheDocument();
  });

  it('renders tab buttons', () => {
    const { container } = render(
      <NFTManager 
        wrappedNFTs={[]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    const tabs = container.querySelectorAll('.tab-new');
    expect(tabs.length).toBe(2);
  });

  it('renders Available to Wrap tab', () => {
    render(
      <NFTManager 
        wrappedNFTs={[]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    expect(screen.getByText(/Available to Wrap/)).toBeInTheDocument();
  });

  it('shows empty state when no wrapped NFTs', () => {
    render(
      <NFTManager 
        wrappedNFTs={[]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    expect(screen.getByText('No Wrapped NFTs')).toBeInTheDocument();
  });

  it('renders Stake $Anon button', () => {
    render(
      <NFTManager 
        wrappedNFTs={[]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    expect(screen.getByText('Stake $Anon')).toBeInTheDocument();
  });

  it('renders wrapped NFT card with token ID', () => {
    render(
      <NFTManager 
        wrappedNFTs={[mockWrappedNFT]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    expect(screen.getByText('Voting NFT #1')).toBeInTheDocument();
  });

  it('displays power stats section', () => {
    render(
      <NFTManager 
        wrappedNFTs={[mockWrappedNFT]} 
        unwrappedNFTs={[mockUnwrappedNFT]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    expect(screen.getByText('Active Power')).toBeInTheDocument();
    expect(screen.getByText('Potential Power')).toBeInTheDocument();
  });

  it('shows Unwrap button for wrapped NFTs', () => {
    render(
      <NFTManager 
        wrappedNFTs={[mockWrappedNFT]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    expect(screen.getByText('Unwrap')).toBeInTheDocument();
  });

  it('renders staking link with correct URL', () => {
    render(
      <NFTManager 
        wrappedNFTs={[]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    const stakingLink = screen.getByText('Stake $Anon').closest('a');
    expect(stakingLink).toHaveAttribute('href', 'https://staking.heyanon.ai');
  });

  it('renders NFT grid container', () => {
    const { container } = render(
      <NFTManager 
        wrappedNFTs={[mockWrappedNFT]} 
        unwrappedNFTs={[]} 
        onUpdate={mockOnUpdate} 
      />
    );
    
    const grid = container.querySelector('.nft-grid-new');
    expect(grid).toBeInTheDocument();
  });
});











