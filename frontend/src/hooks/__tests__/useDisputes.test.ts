import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDisputes } from '../useDisputes';

describe('useDisputes', () => {
  it('returns initial loading state', () => {
    const { result } = renderHook(() => useDisputes());
    
    expect(result.current.loading).toBe(true);
    expect(result.current.disputes).toEqual([]);
  });

  it('provides refetch function', () => {
    const { result } = renderHook(() => useDisputes());
    
    expect(typeof result.current.refetch).toBe('function');
  });

  it('returns disputes as array after loading completes', async () => {
    const { result } = renderHook(() => useDisputes());
    
    // Wait for loading to complete (may or may not have disputes)
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    }, { timeout: 5000 });
    
    expect(Array.isArray(result.current.disputes)).toBe(true);
  });
});











