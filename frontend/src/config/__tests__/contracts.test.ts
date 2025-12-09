import { describe, it, expect } from 'vitest';
import { 
  SONIC_CHAIN, 
  CONTRACTS, 
  DisputeState,
  VoteOption,
  DISPUTE_RESOLVER_ABI,
  ANON_STAKING_ABI,
  VOTE_LABELS,
  STATE_LABELS,
} from '../contracts';

describe('Contract Configuration', () => {
  describe('SONIC_CHAIN', () => {
    it('has correct chain id', () => {
      expect(SONIC_CHAIN.id).toBe(146);
    });

    it('has correct chain name', () => {
      expect(SONIC_CHAIN.name).toBe('Sonic');
    });

    it('has native currency configured', () => {
      expect(SONIC_CHAIN.nativeCurrency).toBeDefined();
      expect(SONIC_CHAIN.nativeCurrency.symbol).toBe('S');
      expect(SONIC_CHAIN.nativeCurrency.decimals).toBe(18);
    });

    it('has RPC URL configured', () => {
      expect(SONIC_CHAIN.rpcUrls.default.http).toBeDefined();
      expect(SONIC_CHAIN.rpcUrls.default.http.length).toBeGreaterThan(0);
      expect(SONIC_CHAIN.rpcUrls.default.http[0]).toContain('soniclabs.com');
    });

    it('has block explorer configured', () => {
      expect(SONIC_CHAIN.blockExplorers.default.url).toBe('https://sonicscan.org');
    });
  });

  describe('CONTRACTS', () => {
    it('has DISPUTE_RESOLVER_HOME address', () => {
      expect(CONTRACTS.DISPUTE_RESOLVER_HOME).toBeDefined();
      expect(CONTRACTS.DISPUTE_RESOLVER_HOME).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('has ANON_STAKING address', () => {
      expect(CONTRACTS.ANON_STAKING).toBeDefined();
      expect(CONTRACTS.ANON_STAKING).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('has VAULT address', () => {
      expect(CONTRACTS.VAULT).toBeDefined();
      expect(CONTRACTS.VAULT).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('has all required addresses', () => {
      expect(CONTRACTS.USDC).toBeDefined();
      expect(CONTRACTS.MARKET_FACTORY).toBeDefined();
    });
  });

  describe('DisputeState', () => {
    it('has correct enum values', () => {
      expect(DisputeState.NotActive).toBe(0);
      expect(DisputeState.Active).toBe(1);
      expect(DisputeState.Resolved).toBe(2);
      expect(DisputeState.Failed).toBe(3);
    });
  });

  describe('VoteOption', () => {
    it('has correct enum values', () => {
      expect(VoteOption.Pending).toBe(0);
      expect(VoteOption.Yes).toBe(1);
      expect(VoteOption.No).toBe(2);
      expect(VoteOption.Unknown).toBe(3);
    });
  });

  describe('Labels', () => {
    it('has vote labels for all options', () => {
      expect(VOTE_LABELS[VoteOption.Pending]).toBe('Pending');
      expect(VOTE_LABELS[VoteOption.Yes]).toBe('Yes - Correct');
      expect(VOTE_LABELS[VoteOption.No]).toBe('No - Incorrect');
      expect(VOTE_LABELS[VoteOption.Unknown]).toBe('Unknown');
    });

    it('has state labels for all states', () => {
      expect(STATE_LABELS[DisputeState.NotActive]).toBe('Not Active');
      expect(STATE_LABELS[DisputeState.Active]).toBe('Active');
      expect(STATE_LABELS[DisputeState.Resolved]).toBe('Resolved');
      expect(STATE_LABELS[DisputeState.Failed]).toBe('Failed');
    });
  });

  describe('ABIs', () => {
    it('DISPUTE_RESOLVER_ABI is an array with functions', () => {
      expect(Array.isArray(DISPUTE_RESOLVER_ABI)).toBe(true);
      expect(DISPUTE_RESOLVER_ABI.length).toBeGreaterThan(0);
    });

    it('ANON_STAKING_ABI is an array with functions', () => {
      expect(Array.isArray(ANON_STAKING_ABI)).toBe(true);
      expect(ANON_STAKING_ABI.length).toBeGreaterThan(0);
    });

    it('DISPUTE_RESOLVER_ABI contains vote function', () => {
      const hasVote = DISPUTE_RESOLVER_ABI.some(item => 
        typeof item === 'string' && item.includes('function vote')
      );
      expect(hasVote).toBe(true);
    });

    it('DISPUTE_RESOLVER_ABI contains depositFor function', () => {
      const hasDeposit = DISPUTE_RESOLVER_ABI.some(item => 
        typeof item === 'string' && item.includes('function depositFor')
      );
      expect(hasDeposit).toBe(true);
    });
  });
});











