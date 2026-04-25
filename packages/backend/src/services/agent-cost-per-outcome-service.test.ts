import { describe, it, expect } from 'vitest';
import {
  computeCostScore,
  getCostTier,
  getCostTierLabel,
  formatTokenCount,
} from './agent-cost-per-outcome-service.js';

describe('computeCostScore', () => {
  it('returns 0 when completedTickets < 2', () => {
    expect(computeCostScore(500, 1)).toBe(0);
    expect(computeCostScore(500, 0)).toBe(0);
  });

  it('returns high score for low cost per outcome', () => {
    // costPerOutcome=0 → 100 - 0 = 100
    expect(computeCostScore(0, 5)).toBe(100);
  });

  it('returns 0 for very high cost per outcome', () => {
    // costPerOutcome=20000 → 100 - (20000/1000)*5 = 100 - 100 = 0
    expect(computeCostScore(20000, 5)).toBe(0);
  });

  it('computes moderate case correctly', () => {
    // costPerOutcome=5000 → 100 - (5000/1000)*5 = 100 - 25 = 75
    expect(computeCostScore(5000, 5)).toBe(75);
  });

  it('clamps minimum at 0', () => {
    expect(computeCostScore(100000, 10)).toBe(0);
  });

  it('clamps maximum at 100', () => {
    expect(computeCostScore(0, 10)).toBe(100);
  });

  it('returns 1-decimal precision', () => {
    const score = computeCostScore(3000, 4);
    expect(Math.round(score * 10) / 10).toBe(score);
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

  it('uses boundary of 2 completed tickets correctly', () => {
    expect(getCostTier(80, 2)).toBe('efficient');
  });
});

describe('getCostTierLabel', () => {
  it('returns Efficient for efficient', () => {
    expect(getCostTierLabel('efficient')).toBe('Efficient');
  });

  it('returns Moderate for moderate', () => {
    expect(getCostTierLabel('moderate')).toBe('Moderate');
  });

  it('returns Inefficient for inefficient', () => {
    expect(getCostTierLabel('inefficient')).toBe('Inefficient');
  });

  it('returns Insufficient Data for insufficient_data', () => {
    expect(getCostTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatTokenCount', () => {
  it('formats small number as plain string', () => {
    expect(formatTokenCount(999)).toBe('999');
  });

  it('formats 1000 as 1.0k', () => {
    expect(formatTokenCount(1000)).toBe('1.0k');
  });

  it('formats 1500 as 1.5k', () => {
    expect(formatTokenCount(1500)).toBe('1.5k');
  });

  it('formats 0 as 0', () => {
    expect(formatTokenCount(0)).toBe('0');
  });
});
