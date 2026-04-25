import { describe, it, expect } from 'vitest';
import {
  computeEfficiencyScore,
  getEfficiencyTier,
  getEfficiencyTierLabel,
  formatRetryRate,
} from '../agent-retry-rate-service.js';

describe('computeEfficiencyScore', () => {
  it('returns 100 for agent with no retries and max 1 session per ticket', () => {
    expect(computeEfficiencyScore(0, 1)).toBe(100);
  });

  it('returns 100 for agent with no retries and 0 sessions (edge)', () => {
    expect(computeEfficiencyScore(0, 0)).toBe(100);
  });

  it('deducts for retry rate', () => {
    // 100 - 0.5*50 - (1-1)*8 = 100 - 25 = 75
    expect(computeEfficiencyScore(0.5, 1)).toBe(75);
  });

  it('deducts for max sessions > 1', () => {
    // 100 - 0 - (3-1)*8 = 100 - 16 = 84
    expect(computeEfficiencyScore(0, 3)).toBe(84);
  });

  it('deducts both retry rate and max sessions', () => {
    // 100 - 0.4*50 - (5-1)*8 = 100 - 20 - 32 = 48
    expect(computeEfficiencyScore(0.4, 5)).toBe(48);
  });

  it('clamps to 0 minimum', () => {
    // 100 - 1*50 - 9*8 = 100-50-72 = negative → 0
    expect(computeEfficiencyScore(1, 10)).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    expect(computeEfficiencyScore(0, 1)).toBe(100);
  });

  it('uses 1 decimal precision', () => {
    // 100 - 0.1*50 - 0 = 95
    expect(computeEfficiencyScore(0.1, 1)).toBe(95);
  });
});

describe('getEfficiencyTier', () => {
  it('returns insufficient_data when totalSessions < 2', () => {
    expect(getEfficiencyTier(100, 0)).toBe('insufficient_data');
    expect(getEfficiencyTier(100, 1)).toBe('insufficient_data');
  });

  it('returns high for score >= 75', () => {
    expect(getEfficiencyTier(75, 5)).toBe('high');
    expect(getEfficiencyTier(100, 5)).toBe('high');
  });

  it('returns moderate for score >= 45', () => {
    expect(getEfficiencyTier(45, 5)).toBe('moderate');
    expect(getEfficiencyTier(74, 5)).toBe('moderate');
  });

  it('returns low for score < 45', () => {
    expect(getEfficiencyTier(0, 5)).toBe('low');
    expect(getEfficiencyTier(44, 5)).toBe('low');
  });

  it('uses totalSessions < 2 boundary correctly', () => {
    expect(getEfficiencyTier(90, 2)).toBe('high');
  });
});

describe('getEfficiencyTierLabel', () => {
  it('maps all tiers to correct labels', () => {
    expect(getEfficiencyTierLabel('high')).toBe('Efficient');
    expect(getEfficiencyTierLabel('moderate')).toBe('Moderate');
    expect(getEfficiencyTierLabel('low')).toBe('High Retry');
    expect(getEfficiencyTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatRetryRate', () => {
  it('formats 0 as 0.0%', () => {
    expect(formatRetryRate(0)).toBe('0.0%');
  });

  it('formats 0.5 as 50.0%', () => {
    expect(formatRetryRate(0.5)).toBe('50.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatRetryRate(1)).toBe('100.0%');
  });

  it('formats with 1 decimal precision', () => {
    expect(formatRetryRate(0.333)).toBe('33.3%');
    expect(formatRetryRate(0.125)).toBe('12.5%');
  });
});
