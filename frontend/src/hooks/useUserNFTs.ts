/**
 * useUserNFTs Hook
 * 
 * Custom React hook for fetching and managing user's staked ANON NFTs.
 * Retrieves both wrapped (in DisputeResolver) and unwrapped (in AnonStaking) NFTs.
 * 
 * Features:
 * - Fetches wrapped NFTs from DisputeResolver contract
 * - Fetches unwrapped NFTs from AnonStaking contract
 * - Provides voting power and status for each NFT
 * - Includes loading and error states
 * 
 * @example
 * ```tsx
 * const { wrappedNFTs, unwrappedNFTs, loading, refetch } = useUserNFTs(userAddress);
 * ```
 */
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, DISPUTE_RESOLVER_ABI, ANON_STAKING_ABI } from '../config/contracts';

/**
 * Represents a user's NFT with voting power information
 */
export interface UserNFT {
  tokenId: string;
  power: string;
  canVote: boolean;
  voteDisabledUntil: number;
  unstakeAvailableAt: number;
  validTo: number;
  isWrapped: boolean;
}

/**
 * Hook to fetch and manage user's NFTs from both wrapped and unwrapped states
 * 
 * @param address - User's wallet address (undefined if not connected)
 * @returns Object containing:
 *   - wrappedNFTs: Array of NFTs deposited in DisputeResolver (can vote)
 *   - unwrappedNFTs: Array of NFTs in AnonStaking (need to wrap to vote)
 *   - loading: Boolean indicating fetch status
 *   - error: Error message if fetch failed, null otherwise
 *   - refetch: Function to manually refresh NFTs
 */
export function useUserNFTs(address: string | undefined) {
  const [wrappedNFTs, setWrappedNFTs] = useState<UserNFT[]>([]);
  const [unwrappedNFTs, setUnwrappedNFTs] = useState<UserNFT[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNFTs = useCallback(async () => {
    if (!address) {
      setWrappedNFTs([]);
      setUnwrappedNFTs([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.providers.JsonRpcProvider('https://rpc.soniclabs.com');
      const disputeResolver = new ethers.Contract(CONTRACTS.DISPUTE_RESOLVER_HOME, DISPUTE_RESOLVER_ABI, provider);
      const anonStaking = new ethers.Contract(CONTRACTS.ANON_STAKING, ANON_STAKING_ABI, provider);

      // Fetch wrapped NFTs (in DisputeResolver)
      const wrappedBalance = await disputeResolver.balanceOf(address);
      const wrappedPromises: Promise<UserNFT>[] = [];

      for (let i = 0; i < wrappedBalance.toNumber(); i++) {
        wrappedPromises.push(
          (async () => {
            const tokenId = await disputeResolver.tokenOfOwnerByIndex(address, i);
            const info = await disputeResolver.nftInfos(tokenId);
            const canVote = await disputeResolver.canVote(tokenId);

            return {
              tokenId: tokenId.toString(),
              power: ethers.utils.formatUnits(info.power, 18),
              canVote,
              voteDisabledUntil: info.voteDisabledUntil,
              unstakeAvailableAt: info.unstakeAvailableAt,
              validTo: info.validTo,
              isWrapped: true,
            };
          })()
        );
      }

      // Fetch unwrapped NFTs (in AnonStaking, ready to wrap)
      const unwrappedBalance = await anonStaking.balanceOf(address);
      const unwrappedPromises: Promise<UserNFT | null>[] = [];

      for (let i = 0; i < unwrappedBalance.toNumber(); i++) {
        unwrappedPromises.push(
          (async () => {
            try {
              const tokenId = await anonStaking.tokenOfOwnerByIndex(address, i);
              const [position] = await anonStaking.positionOf(tokenId);

              return {
                tokenId: tokenId.toString(),
                power: ethers.utils.formatUnits(position.amount, 18),
                canVote: false,
                voteDisabledUntil: 0,
                unstakeAvailableAt: 0,
                validTo: position.lockedUntil,
                isWrapped: false,
              };
            } catch {
              return null;
            }
          })()
        );
      }

      const [wrapped, unwrapped] = await Promise.all([
        Promise.all(wrappedPromises),
        Promise.all(unwrappedPromises),
      ]);

      setWrappedNFTs(wrapped);
      setUnwrappedNFTs(unwrapped.filter((n): n is UserNFT => n !== null));
    } catch (err) {
      console.error('Error fetching NFTs:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch NFTs');
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchNFTs();
  }, [fetchNFTs]);

  return { wrappedNFTs, unwrappedNFTs, loading, error, refetch: fetchNFTs };
}


