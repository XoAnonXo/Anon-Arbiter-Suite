import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useUserNFTs } from '../useUserNFTs';

describe('useUserNFTs', () => {
  it('returns empty arrays when no address provided', () => {
    const { result } = renderHook(() => useUserNFTs(undefined));
    
    expect(result.current.wrappedNFTs).toEqual([]);
    expect(result.current.unwrappedNFTs).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it('provides refetch function', () => {
    const { result } = renderHook(() => useUserNFTs(undefined));
    
    expect(typeof result.current.refetch).toBe('function');
  });

  it('returns NFT arrays as arrays', async () => {
    const { result } = renderHook(() => useUserNFTs(undefined));
    
    expect(Array.isArray(result.current.wrappedNFTs)).toBe(true);
    expect(Array.isArray(result.current.unwrappedNFTs)).toBe(true);
  });

  it('returns loading state initially when address is provided', () => {
    const { result } = renderHook(() => 
      useUserNFTs('0x1234567890123456789012345678901234567890')
    );
    
    // Loading starts as true when address is provided
    expect(result.current.loading).toBe(true);
  });
});











