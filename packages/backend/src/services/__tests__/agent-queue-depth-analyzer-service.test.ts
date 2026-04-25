import { describe, it, expect } from 'vitest';
import {
  computeQueueScore,
  getQueueTier,
  getQueueTierLabel,
} from '../agent-queue-depth-analyzer-service.js';

describe('computeQueueScore', () => {
  it('returns 0 for agent with no active tickets and no age', () => {
    expect(computeQueueScore(0, 0)).toBe(0);
  });

  it('scores single ticket with 0 age at 10', () => {
    expect(computeQueueScore(1, 0)).toBe(10);
  });

  it('scores by ticket count only when age is 0', () => {
    // 5 tickets * 10 = 50
    expect(computeQueueScore(5, 0)).toBe(50);
  });

  it('adds age contribution (capped at 50)', () => {
    // 0 tickets + 240h age → 240/24*5 = 50 → total 50
    expect(computeQueueScore(0, 240)).toBe(50);
  });

  it('age contribution capped at 50 for large ages', () => {
    // 0 tickets + 1000h age → min(50, 1000/24*5) = 50 → total 50
    expect(computeQueueScore(0, 1000)).toBe(50);
  });

  it('clamps combined score at 100', () => {
    // 10 tickets * 10 = 100 + age = clamped at 100
    expect(computeQueueScore(10, 100)).toBe(100);
  });

  it('returns 100 for very large queue', () => {
    expect(computeQueueScore(20, 500)).toBe(100);
  });

  it('uses 1 decimal precision', () => {
    // 3 tickets * 10 = 30 + 24h/24*5 = 5 → 35
    expect(computeQueueScore(3, 24)).toBe(35);
  });
});

describe('getQueueTier', () => {
  it('returns idle when totalActiveTickets is 0', () => {
    expect(getQueueTier(0, 0)).toBe('idle');
    expect(getQueueTier(100, 0)).toBe('idle');
  });

  it('returns overloaded for score >= 70', () => {
    expect(getQueueTier(70, 5)).toBe('overloaded');
    expect(getQueueTier(100, 5)).toBe('overloaded');
  });

  it('returns busy for score >= 40', () => {
    expect(getQueueTier(40, 5)).toBe('busy');
    expect(getQueueTier(69, 5)).toBe('busy');
  });

  it('returns normal for score >= 0 with active tickets', () => {
    expect(getQueueTier(0, 1)).toBe('normal');
    expect(getQueueTier(39, 3)).toBe('normal');
  });

  it('returns idle not normal when totalActiveTickets is 0 even with positive score', () => {
    expect(getQueueTier(50, 0)).toBe('idle');
  });
});

describe('getQueueTierLabel', () => {
  it('maps all tiers to correct labels', () => {
    expect(getQueueTierLabel('overloaded')).toBe('Overloaded');
    expect(getQueueTierLabel('busy')).toBe('Busy');
    expect(getQueueTierLabel('normal')).toBe('Normal');
    expect(getQueueTierLabel('idle')).toBe('Idle');
  });
});
