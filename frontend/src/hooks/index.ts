/**
 * Hooks barrel export file
 * 
 * This file exports all custom hooks from a single location.
 * Usage: import { useDisputes, useUserNFTs, useMarkets } from './hooks';
 */

export { useDisputes } from './useDisputes';
export type { Dispute } from './useDisputes';

export { useUserNFTs } from './useUserNFTs';
export type { UserNFT } from './useUserNFTs';

export { useMarkets, MarketStatus, MARKET_STATUS_LABELS } from './useMarkets';
export type { Market } from './useMarkets';

