import { describe, it, expect, vi } from 'vitest';
import { computeUnblockedScore, getUnblockedTier } from '../agent-blocked-time-service.js';

vi.mock('../../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({ default: vi.fn() }));

describe('computeUnblockedScore', () => {
  it('returns 100 for no blocked time', () => {
    expect(computeUnblockedScore(0, 0, 0)).toBe(100);
  });

  it('returns 0 for fully capped inputs (100, 24, 72)', () => {
    expect(computeUnblockedScore(100, 24, 72)).toBe(0);
  });

  it('penalizes blockedTimeRate proportionally', () => {
    const half = computeUnblockedScore(50, 0, 0);
    expect(half).toBe(75);
  });

  it('caps avgBlockDuration penalty at -30', () => {
    const big = computeUnblockedScore(0, 100, 0);
    const capped = computeUnblockedScore(0, 36, 0);
    expect(big).toBe(capped);
  });
});

describe('getUnblockedTier', () => {
  it('returns unblocked for score >= 75', () => {
    expect(getUnblockedTier(75)).toBe('unblocked');
    expect(getUnblockedTier(100)).toBe('unblocked');
  });

  it('returns occasionally-blocked for 50 <= score < 75', () => {
    expect(getUnblockedTier(74)).toBe('occasionally-blocked');
    expect(getUnblockedTier(50)).toBe('occasionally-blocked');
  });

  it('returns frequently-blocked for 25 <= score < 50', () => {
    expect(getUnblockedTier(49)).toBe('frequently-blocked');
    expect(getUnblockedTier(25)).toBe('frequently-blocked');
  });

  it('returns perpetually-blocked for score < 25', () => {
    expect(getUnblockedTier(24)).toBe('perpetually-blocked');
    expect(getUnblockedTier(0)).toBe('perpetually-blocked');
  });
});

describe('blockedTimeRate formula', () => {
  it('3 blocked / 10 total = 30.0', () => {
    const rate = (3 / 10) * 100;
    expect(rate).toBe(30);
  });
});
