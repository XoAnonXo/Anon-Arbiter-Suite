/**
 * useDisputes Hook
 * 
 * Custom React hook for fetching and managing dispute data from
 * the Arbiter Suite smart contracts on Sonic Mainnet.
 * 
 * Features:
 * - Tries indexer first for faster responses
 * - Falls back to direct contract calls with Multicall3 if indexer unavailable
 * - Provides loading and error states
 * - Includes refetch function for manual refreshing
 * 
 * @example
 * ```tsx
 * const { disputes, loading, error, refetch } = useDisputes();
 * ```
 */
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { CONTRACTS, INDEXER_URL, DisputeState, VoteOption, MULTICALL3_ABI } from '../config/contracts';

/**
 * Represents a dispute in the Arbiter Suite system
 */
export interface Dispute {
  oracle: string;
  disputer: string;
  isCollateralTaken: boolean;
  state: DisputeState;
  draftStatus: VoteOption;
  finalStatus: VoteOption;
  disputerDeposit: string;
  endAt: number;
  marketToken: string;
  reason: string;
  yesVotes: string;
  noVotes: string;
  unknownVotes: string;
  marketName?: string;
}

// Interface for dispute resolver ABI
const disputeResolverInterface = new ethers.utils.Interface([
  'function getDisputeInfo(address oracle) view returns (address disputer, bool isCollateralTaken, uint8 state, uint8 draftStatus, uint8 finalStatus, uint256 disputerDeposit, uint256 endAt, address marketToken, string reason)',
  'function getVoteCount(address oracle, uint8 option) view returns (uint256)',
  'event DisputeCreated(address indexed disputer, address indexed oracle, uint8 draftStatus, uint256 amount, address marketToken)',
]);

/**
 * Hook to fetch and manage disputes from the Arbiter Suite protocol
 * 
 * @returns Object containing:
 *   - disputes: Array of Dispute objects
 *   - loading: Boolean indicating fetch status
 *   - error: Error message if fetch failed, null otherwise
 *   - refetch: Function to manually refresh disputes
 */
export function useDisputes() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFromIndexer = async (): Promise<Dispute[]> => {
    try {
      const response = await fetch(`${INDEXER_URL}/api/disputes`);
      if (!response.ok) throw new Error('Indexer unavailable');
      const data = await response.json();
      return data.disputes || [];
    } catch {
      console.log('Indexer unavailable, falling back to contract');
      return [];
    }
  };

  const fetchFromContract = async (): Promise<Dispute[]> => {
    const provider = new ethers.providers.JsonRpcProvider('https://rpc.soniclabs.com');
    const multicall = new ethers.Contract(CONTRACTS.MULTICALL3, MULTICALL3_ABI, provider);
    
    // Get dispute events to find oracles with disputes
    const eventSignature = disputeResolverInterface.getEventTopic('DisputeCreated');
    const events = await provider.getLogs({
      address: CONTRACTS.DISPUTE_RESOLVER_HOME,
      topics: [eventSignature],
      fromBlock: 0,
      toBlock: 'latest',
    });
    
    console.log(`[useDisputes] Found ${events.length} dispute events`);
    
    if (events.length === 0) {
      return [];
    }

    // Extract oracle addresses from events
    const oracles = events.map(event => {
      const parsed = disputeResolverInterface.parseLog(event);
      return parsed.args.oracle;
    });

    // Build multicall - for each oracle we need: getDisputeInfo, getVoteCount(Yes), getVoteCount(No), getVoteCount(Unknown)
    const calls: { target: string; allowFailure: boolean; callData: string }[] = [];
    
    for (const oracle of oracles) {
      calls.push({
        target: CONTRACTS.DISPUTE_RESOLVER_HOME,
        allowFailure: true,
        callData: disputeResolverInterface.encodeFunctionData('getDisputeInfo', [oracle]),
      });
      calls.push({
        target: CONTRACTS.DISPUTE_RESOLVER_HOME,
        allowFailure: true,
        callData: disputeResolverInterface.encodeFunctionData('getVoteCount', [oracle, VoteOption.Yes]),
      });
      calls.push({
        target: CONTRACTS.DISPUTE_RESOLVER_HOME,
        allowFailure: true,
        callData: disputeResolverInterface.encodeFunctionData('getVoteCount', [oracle, VoteOption.No]),
      });
      calls.push({
        target: CONTRACTS.DISPUTE_RESOLVER_HOME,
        allowFailure: true,
        callData: disputeResolverInterface.encodeFunctionData('getVoteCount', [oracle, VoteOption.Unknown]),
      });
    }

    console.log(`[useDisputes] Executing multicall with ${calls.length} calls`);

    // Execute multicall
    const results = await multicall.aggregate3(calls);

    // Parse results - each dispute has 4 calls
    const disputeList: Dispute[] = [];
    const CALLS_PER_DISPUTE = 4;

    for (let i = 0; i < oracles.length; i++) {
      const baseIdx = i * CALLS_PER_DISPUTE;
      const oracle = oracles[i];

      try {
        const infoResult = results[baseIdx];
        const yesResult = results[baseIdx + 1];
        const noResult = results[baseIdx + 2];
        const unknownResult = results[baseIdx + 3];

        if (!infoResult.success) {
          continue;
        }

        const info = disputeResolverInterface.decodeFunctionResult('getDisputeInfo', infoResult.returnData);
        const yesVotes = yesResult.success 
          ? disputeResolverInterface.decodeFunctionResult('getVoteCount', yesResult.returnData)[0]
          : ethers.BigNumber.from(0);
        const noVotes = noResult.success
          ? disputeResolverInterface.decodeFunctionResult('getVoteCount', noResult.returnData)[0]
          : ethers.BigNumber.from(0);
        const unknownVotes = unknownResult.success
          ? disputeResolverInterface.decodeFunctionResult('getVoteCount', unknownResult.returnData)[0]
          : ethers.BigNumber.from(0);

        disputeList.push({
          oracle,
          disputer: info.disputer,
          isCollateralTaken: info.isCollateralTaken,
          state: info.state as DisputeState,
          draftStatus: info.draftStatus as VoteOption,
          finalStatus: info.finalStatus as VoteOption,
          disputerDeposit: ethers.utils.formatUnits(info.disputerDeposit, 6),
          endAt: info.endAt.toNumber(),
          marketToken: info.marketToken,
          reason: info.reason,
          yesVotes: ethers.utils.formatUnits(yesVotes, 18),
          noVotes: ethers.utils.formatUnits(noVotes, 18),
          unknownVotes: ethers.utils.formatUnits(unknownVotes, 18),
        });
      } catch (err) {
        console.error(`[useDisputes] Error decoding dispute ${i}:`, err);
      }
    }

    console.log(`[useDisputes] Successfully processed ${disputeList.length}/${oracles.length} disputes`);
    return disputeList;
  };

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Try indexer first
      let data = await fetchFromIndexer();
      
      // Fallback to contract if indexer fails
      if (data.length === 0) {
        data = await fetchFromContract();
      }

      setDisputes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch disputes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  return { disputes, loading, error, refetch: fetchDisputes };
}


