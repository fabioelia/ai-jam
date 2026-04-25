import { describe, it, expect } from 'vitest';
import {
  computeCostScore,
  getCostTier,
  getCostTierLabel,
  formatTokenCount,
} from '../agent-cost-per-outcome-service.js';

describe('computeCostScore', () => {
  it('returns 0 when completedTickets < 2', () => {
    expect(computeCostScore(1000, 1)).toBe(0);
    expect(computeCostScore(1000, 0)).toBe(0);
  });

  it('computes efficient case', () => {
    // cost=1000, tickets=5: 100 - (1000/1000)*5 = 100 - 5 = 95
    expect(computeCostScore(1000, 5)).toBe(95);
  });

  it('computes moderate case', () => {
    // cost=11000, tickets=5: 100 - (11000/1000)*5 = 100 - 55 = 45
    expect(computeCostScore(11000, 5)).toBe(45);
  });

  it('computes inefficient case', () => {
    // cost=20000, tickets=5: 100 - (20000/1000)*5 = 100 - 100 = 0
    expect(computeCostScore(20000, 5)).toBe(0);
  });

  it('clamps at 0 when cost is very high', () => {
    // cost=30000, tickets=5: 100 - 150 = -50 → 0
    expect(computeCostScore(30000, 5)).toBe(0);
  });

  it('returns 100 when cost is 0', () => {
    expect(computeCostScore(0, 5)).toBe(100);
  });
});

describe('getCostTier', () => {
  it('returns insufficient_data when completedTickets < 2', () => {
    expect(getCostTier(100, 1)).toBe('insufficient_data');
    expect(getCostTier(100, 0)).toBe('insufficient_data');
  });

  it('returns efficient when score >= 75', () => {
    expect(getCostTier(75, 5)).toBe('efficient');
    expect(getCostTier(100, 5)).toBe('efficient');
  });

  it('returns moderate when score >= 45', () => {
    expect(getCostTier(45, 5)).toBe('moderate');
    expect(getCostTier(74, 5)).toBe('moderate');
  });

  it('returns inefficient when score < 45', () => {
    expect(getCostTier(44, 5)).toBe('inefficient');
    expect(getCostTier(0, 5)).toBe('inefficient');
  });
});

describe('getCostTierLabel', () => {
  it('returns correct label for efficient', () => {
    expect(getCostTierLabel('efficient')).toBe('Efficient');
  });

  it('returns correct label for moderate', () => {
    expect(getCostTierLabel('moderate')).toBe('Moderate');
  });

  it('returns correct label for inefficient', () => {
    expect(getCostTierLabel('inefficient')).toBe('Inefficient');
  });

  it('returns correct label for insufficient_data', () => {
    expect(getCostTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatTokenCount', () => {
  it('formats 500 as 500', () => {
    expect(formatTokenCount(500)).toBe('500');
  });

  it('formats 1000 as 1.0k', () => {
    expect(formatTokenCount(1000)).toBe('1.0k');
  });

  it('formats 2500 as 2.5k', () => {
    expect(formatTokenCount(2500)).toBe('2.5k');
  });
});
