/**
 * useMarkets Hook
 * 
 * Custom React hook for fetching markets from on-chain that have
 * our DisputeResolverHome contract designated as the arbiter.
 * 
 * Features:
 * - Fetches all markets from MarketFactory events
 * - Uses Multicall3 for efficient batched RPC calls
 * - Filters for markets with our arbiter
 * - Shows finalized/resolved status
 * - Provides loading and error states
 * 
 * @example
 * ```tsx
 * const { markets, loading, error, refetch } = useMarkets();
 * ```
 */
import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { 
  CONTRACTS, 
  INDEXER_URL,
  AMM_MARKET_CREATED_EVENT_SIG,
  PARI_MARKET_CREATED_EVENT_SIG,
  MULTICALL3_ABI
} from '../config/contracts';

/**
 * Market status representing the poll state
 */
export const MarketStatus = {
  Pending: 0,
  Yes: 1,
  No: 2,
  Unknown: 3,
} as const;
export type MarketStatus = (typeof MarketStatus)[keyof typeof MarketStatus];

export const MARKET_STATUS_LABELS: Record<MarketStatus, string> = {
  [MarketStatus.Pending]: 'Pending',
  [MarketStatus.Yes]: 'Yes',
  [MarketStatus.No]: 'No',
  [MarketStatus.Unknown]: 'Unknown',
};

/**
 * Represents a market with our arbiter
 */
export interface Market {
  pollAddress: string;
  marketAddress: string;
  arbiter: string;
  isFinalized: boolean;
  status: MarketStatus;
  arbitrationStarted: boolean;
  collateralToken: string;
  collateralSymbol: string;
  collateralDecimals: number;
  isOurArbiter: boolean;
  tvl: string; // TVL in raw units
  requiredCollateral: string; // Required collateral in raw units (1% of TVL, min 1e6)
  marketType: 'amm' | 'pari'; // Type of market
  question?: string; // Market question (if available)
  description?: string; // Market description (if available)
  rules?: string; // Market rules (if available)
  resolutionReason?: string; // AI resolution reasoning (if resolved)
  sources?: string; // Sources used for resolution
}

/**
 * Poll metadata from the indexer
 */
interface PollMetadata {
  id: string;
  question: string;
  rules: string;
  resolutionReason: string | null;
  sources: string;
  status: number;
}

/**
 * Fetch poll metadata from the GraphQL indexer
 */
async function fetchPollMetadata(pollAddresses: string[]): Promise<Map<string, PollMetadata>> {
  const metadataMap = new Map<string, PollMetadata>();
  
  if (pollAddresses.length === 0) return metadataMap;
  
  try {
    // Build the GraphQL query to fetch all polls by their addresses
    const addressList = pollAddresses.map(addr => `"${addr.toLowerCase()}"`).join(', ');
    const query = `{
      pollss(where: { id_in: [${addressList}] }, limit: 1000) {
        items {
          id
          question
          rules
          resolutionReason
          sources
          status
        }
      }
    }`;

    const response = await fetch(INDEXER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });

    if (!response.ok) {
      console.warn('[useMarkets] Indexer request failed:', response.status);
      return metadataMap;
    }

    const data = await response.json();
    const polls = data?.data?.pollss?.items || [];

    console.log(`[useMarkets] Fetched metadata for ${polls.length} polls from indexer`);

    for (const poll of polls) {
      metadataMap.set(poll.id.toLowerCase(), poll);
    }
  } catch (err) {
    console.warn('[useMarkets] Failed to fetch poll metadata from indexer:', err);
  }

  return metadataMap;
}

// Interface for poll and market contract ABIs
const pollInterface = new ethers.utils.Interface([
  'function getArbiter() view returns (address)',
  'function getFinalizedStatus() view returns (bool isFinalized, uint8 status)',
  'function arbitrationStarted() view returns (bool)',
]);

const marketInterface = new ethers.utils.Interface([
  'function collateralToken() view returns (address)',
  'function getReserves() view returns (uint112 r0, uint112 r1, uint256 r2, uint256 r3, uint256 tvl)',
]);

const erc20Interface = new ethers.utils.Interface([
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
]);

// Constants matching the smart contract
const MINIMUM_COLLATERAL = ethers.BigNumber.from('1000000'); // 1 USDC (6 decimals)
const COLLATERAL_DIVISOR = 100; // 1% of TVL

/**
 * Hook to fetch markets from on-chain that have our arbiter
 * 
 * @param onlyOurArbiter - If true, only return markets with our arbiter (default: true)
 * @returns Object containing:
 *   - markets: Array of Market objects
 *   - loading: Boolean indicating fetch status
 *   - error: Error message if fetch failed, null otherwise
 *   - refetch: Function to manually refresh markets
 *   - stats: Summary statistics about markets
 */
export function useMarkets(onlyOurArbiter: boolean = true) {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    withOurArbiter: 0,
    finalized: 0,
    inArbitration: 0,
  });

  const fetchMarkets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const provider = new ethers.providers.JsonRpcProvider('https://rpc.soniclabs.com');
      const multicall = new ethers.Contract(CONTRACTS.MULTICALL3, MULTICALL3_ABI, provider);
      
      // Get all MarketCreated events from the MarketFactory (both AMM and PariMutuel)
      const [ammLogs, pariLogs] = await Promise.all([
        provider.getLogs({
          address: CONTRACTS.MARKET_FACTORY,
          topics: [AMM_MARKET_CREATED_EVENT_SIG],
          fromBlock: 0,
          toBlock: 'latest',
        }),
        provider.getLogs({
          address: CONTRACTS.MARKET_FACTORY,
          topics: [PARI_MARKET_CREATED_EVENT_SIG],
          fromBlock: 0,
          toBlock: 'latest',
        }),
      ]);

      console.log(`[useMarkets] Found ${ammLogs.length} AMM markets, ${pariLogs.length} PariMutuel markets`);

      // Mark each log with its market type
      const ammLogsWithType = ammLogs.map(log => ({ ...log, marketType: 'amm' as const }));
      const pariLogsWithType = pariLogs.map(log => ({ ...log, marketType: 'pari' as const }));
      
      // Combine all logs
      const logs = [...ammLogsWithType, ...pariLogsWithType];

      if (logs.length === 0) {
        setMarkets([]);
        setStats({ total: 0, withOurArbiter: 0, finalized: 0, inArbitration: 0 });
        setLoading(false);
        return;
      }

      // Extract poll and market addresses from logs
      const marketData = logs.map(log => ({
        pollAddress: ethers.utils.getAddress('0x' + log.topics[1].slice(26)),
        marketAddress: ethers.utils.getAddress('0x' + log.topics[2].slice(26)),
        marketType: log.marketType,
      }));

      // Build multicall calls for all markets
      // For each market we need: getArbiter, getFinalizedStatus, arbitrationStarted, collateralToken, getReserves
      const calls: { target: string; allowFailure: boolean; callData: string }[] = [];
      
      for (const { pollAddress, marketAddress } of marketData) {
        // Poll calls
        calls.push({
          target: pollAddress,
          allowFailure: true,
          callData: pollInterface.encodeFunctionData('getArbiter'),
        });
        calls.push({
          target: pollAddress,
          allowFailure: true,
          callData: pollInterface.encodeFunctionData('getFinalizedStatus'),
        });
        calls.push({
          target: pollAddress,
          allowFailure: true,
          callData: pollInterface.encodeFunctionData('arbitrationStarted'),
        });
        // Market calls
        calls.push({
          target: marketAddress,
          allowFailure: true,
          callData: marketInterface.encodeFunctionData('collateralToken'),
        });
        calls.push({
          target: marketAddress,
          allowFailure: true,
          callData: marketInterface.encodeFunctionData('getReserves'),
        });
      }

      console.log(`[useMarkets] Executing multicall with ${calls.length} calls`);

      // Execute all calls in a single multicall (Multicall3 can handle thousands of calls)
      const allResults: { success: boolean; returnData: string }[] = await multicall.aggregate3(calls);
      console.log(`[useMarkets] Multicall complete`);

      // Get all unique collateral tokens to fetch their symbol/decimals
      const collateralTokens = new Set<string>();
      const CALLS_PER_MARKET = 5;
      
      for (let i = 0; i < marketData.length; i++) {
        const collateralIdx = i * CALLS_PER_MARKET + 3;
        const collateralResult = allResults[collateralIdx];
        if (collateralResult.success) {
          try {
            const token = marketInterface.decodeFunctionResult('collateralToken', collateralResult.returnData)[0];
            if (token && token !== ethers.constants.AddressZero) {
              collateralTokens.add(token.toLowerCase());
            }
          } catch {
            // Ignore decoding errors
          }
        }
      }

      // Fetch token info for all collateral tokens
      const tokenInfoCalls: { target: string; allowFailure: boolean; callData: string }[] = [];
      const tokenAddresses = Array.from(collateralTokens);
      
      for (const token of tokenAddresses) {
        tokenInfoCalls.push({
          target: token,
          allowFailure: true,
          callData: erc20Interface.encodeFunctionData('symbol'),
        });
        tokenInfoCalls.push({
          target: token,
          allowFailure: true,
          callData: erc20Interface.encodeFunctionData('decimals'),
        });
      }

      // Fetch token info if there are any tokens
      const tokenInfoMap: Record<string, { symbol: string; decimals: number }> = {};
      if (tokenInfoCalls.length > 0) {
        const tokenResults: { success: boolean; returnData: string }[] = await multicall.aggregate3(tokenInfoCalls);
        
        for (let i = 0; i < tokenAddresses.length; i++) {
          const symbolResult = tokenResults[i * 2];
          const decimalsResult = tokenResults[i * 2 + 1];
          
          let symbol = 'TOKEN';
          let decimals = 6;
          
          if (symbolResult.success) {
            try {
              symbol = erc20Interface.decodeFunctionResult('symbol', symbolResult.returnData)[0];
            } catch {
              // Use default
            }
          }
          
          if (decimalsResult.success) {
            try {
              decimals = erc20Interface.decodeFunctionResult('decimals', decimalsResult.returnData)[0];
            } catch {
              // Use default
            }
          }
          
          tokenInfoMap[tokenAddresses[i]] = { symbol, decimals };
        }
      }

      // Parse results - each market has 5 calls
      const allMarkets: Market[] = [];

      for (let i = 0; i < marketData.length; i++) {
        const baseIdx = i * CALLS_PER_MARKET;
        const { pollAddress, marketAddress, marketType } = marketData[i];

        try {
          const arbiterResult = allResults[baseIdx];
          const finalizedResult = allResults[baseIdx + 1];
          const arbitrationResult = allResults[baseIdx + 2];
          const collateralResult = allResults[baseIdx + 3];
          const reservesResult = allResults[baseIdx + 4];

          // Skip if any critical call failed
          if (!arbiterResult.success || !finalizedResult.success || !arbitrationResult.success) {
            continue;
          }

          // Decode results
          const arbiter = pollInterface.decodeFunctionResult('getArbiter', arbiterResult.returnData)[0];
          const [isFinalized, status] = pollInterface.decodeFunctionResult('getFinalizedStatus', finalizedResult.returnData);
          const arbitrationStarted = pollInterface.decodeFunctionResult('arbitrationStarted', arbitrationResult.returnData)[0];
          
          let collateralToken = '';
          let collateralSymbol = 'TOKEN';
          let collateralDecimals = 6;
          if (collateralResult.success) {
            try {
              collateralToken = marketInterface.decodeFunctionResult('collateralToken', collateralResult.returnData)[0];
              const tokenInfo = tokenInfoMap[collateralToken.toLowerCase()];
              if (tokenInfo) {
                collateralSymbol = tokenInfo.symbol;
                collateralDecimals = tokenInfo.decimals;
              }
            } catch {
              // Ignore decoding errors for collateral token
            }
          }

          // Get TVL from reserves
          let tvl = ethers.BigNumber.from(0);
          if (reservesResult.success) {
            try {
              const decoded = marketInterface.decodeFunctionResult('getReserves', reservesResult.returnData);
              tvl = decoded.tvl || decoded[4]; // tvl is the 5th return value
            } catch {
              // Some markets might not have getReserves (Parimutuel), TVL remains 0
            }
          }

          // Calculate required collateral: 1% of TVL, minimum 1e6
          const calculatedCollateral = tvl.div(COLLATERAL_DIVISOR);
          const requiredCollateral = calculatedCollateral.lt(MINIMUM_COLLATERAL) 
            ? MINIMUM_COLLATERAL 
            : calculatedCollateral;

          const isOurArbiter = arbiter.toLowerCase() === CONTRACTS.DISPUTE_RESOLVER_HOME.toLowerCase();

          allMarkets.push({
            pollAddress,
            marketAddress,
            arbiter,
            isFinalized,
            status: status as MarketStatus,
            arbitrationStarted,
            collateralToken,
            collateralSymbol,
            collateralDecimals,
            isOurArbiter,
            tvl: tvl.toString(),
            requiredCollateral: requiredCollateral.toString(),
            marketType,
            // Question/description/rules would be fetched from off-chain metadata if available
            question: undefined,
            description: undefined,
            rules: undefined,
          });
        } catch (e) {
          // Skip markets that error during decoding
          console.warn(`[useMarkets] Failed to decode market ${i}:`, e);
        }
      }

      console.log(`[useMarkets] Successfully processed ${allMarkets.length}/${marketData.length} markets`);

      // Fetch poll metadata from indexer (question, rules, resolution reason)
      const pollAddresses = allMarkets.map(m => m.pollAddress);
      const pollMetadata = await fetchPollMetadata(pollAddresses);

      // Merge metadata into markets
      for (const market of allMarkets) {
        const metadata = pollMetadata.get(market.pollAddress.toLowerCase());
        if (metadata) {
          market.question = metadata.question || undefined;
          market.rules = metadata.rules || undefined;
          market.resolutionReason = metadata.resolutionReason || undefined;
          market.sources = metadata.sources || undefined;
        }
      }

      // Calculate stats
      const totalStats = {
        total: allMarkets.length,
        withOurArbiter: allMarkets.filter(m => m.isOurArbiter).length,
        finalized: allMarkets.filter(m => m.isFinalized).length,
        inArbitration: allMarkets.filter(m => m.arbitrationStarted).length,
      };
      setStats(totalStats);

      console.log(`[useMarkets] Stats:`, totalStats);

      // Filter based on preference
      const filteredMarkets = onlyOurArbiter 
        ? allMarkets.filter(m => m.isOurArbiter)
        : allMarkets;

      // Sort: in arbitration first, then non-finalized, then finalized
      filteredMarkets.sort((a, b) => {
        if (a.arbitrationStarted !== b.arbitrationStarted) {
          return a.arbitrationStarted ? -1 : 1;
        }
        if (a.isFinalized !== b.isFinalized) {
          return a.isFinalized ? 1 : -1;
        }
        return 0;
      });

      setMarkets(filteredMarkets);
    } catch (err) {
      console.error('[useMarkets] Error fetching markets:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch markets');
    } finally {
      setLoading(false);
    }
  }, [onlyOurArbiter]);

  useEffect(() => {
    fetchMarkets();
  }, [fetchMarkets]);

  return { markets, loading, error, refetch: fetchMarkets, stats };
}
