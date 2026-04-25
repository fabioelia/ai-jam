import { describe, it, expect } from 'vitest';
import {
  computeHealthScore,
  getHealthTier,
  getHealthTierLabel,
  formatFailureRate,
} from '../agent-failure-pattern-service.js';

describe('computeHealthScore', () => {
  it('returns 0 for insufficient data (< 3 sessions)', () => {
    expect(computeHealthScore(0, 0, 0)).toBe(0);
    expect(computeHealthScore(2, 0, 0)).toBe(0);
  });

  it('returns 100 for agent with no failures', () => {
    expect(computeHealthScore(10, 0, 0)).toBe(100);
  });

  it('deducts for failure rate', () => {
    // totalSessions=10, failureRate=0.5, maxConsecutive=0
    // 100 - 0.5*60 - 0 = 100 - 30 = 70
    expect(computeHealthScore(10, 0.5, 0)).toBe(70);
  });

  it('deducts for consecutive failures', () => {
    // totalSessions=5, failureRate=0, maxConsecutive=5
    // 100 - 0 - 5*8 = 100 - 40 = 60
    expect(computeHealthScore(5, 0, 5)).toBe(60);
  });

  it('combines failure rate and consecutive deductions', () => {
    // totalSessions=10, failureRate=0.3, maxConsecutive=3
    // 100 - 0.3*60 - 3*8 = 100 - 18 - 24 = 58
    expect(computeHealthScore(10, 0.3, 3)).toBe(58);
  });

  it('clamps to 0 minimum', () => {
    // totalSessions=10, failureRate=2, maxConsecutive=10
    // 100 - 120 - 80 = very negative → 0
    expect(computeHealthScore(10, 2, 10)).toBe(0);
  });

  it('uses 1 decimal precision', () => {
    // totalSessions=6, failureRate=0.1, maxConsecutive=1
    // 100 - 0.1*60 - 1*8 = 100 - 6 - 8 = 86
    expect(computeHealthScore(6, 0.1, 1)).toBe(86);
  });
});

describe('getHealthTier', () => {
  it('returns insufficient_data for < 3 sessions', () => {
    expect(getHealthTier(100, 0)).toBe('insufficient_data');
    expect(getHealthTier(100, 2)).toBe('insufficient_data');
  });

  it('returns high for score >= 80', () => {
    expect(getHealthTier(80, 5)).toBe('high');
    expect(getHealthTier(100, 5)).toBe('high');
  });

  it('returns moderate for score >= 50', () => {
    expect(getHealthTier(50, 5)).toBe('moderate');
    expect(getHealthTier(79, 5)).toBe('moderate');
  });

  it('returns low for score < 50', () => {
    expect(getHealthTier(0, 5)).toBe('low');
    expect(getHealthTier(49, 5)).toBe('low');
  });
});

describe('getHealthTierLabel', () => {
  it('maps tiers to correct labels', () => {
    expect(getHealthTierLabel('high')).toBe('Healthy');
    expect(getHealthTierLabel('moderate')).toBe('Degraded');
    expect(getHealthTierLabel('low')).toBe('Failing');
    expect(getHealthTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatFailureRate', () => {
  it('formats 0 as 0.0%', () => {
    expect(formatFailureRate(0)).toBe('0.0%');
  });

  it('formats 0.5 as 50.0%', () => {
    expect(formatFailureRate(0.5)).toBe('50.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatFailureRate(1)).toBe('100.0%');
  });

  it('formats with 1 decimal precision', () => {
    expect(formatFailureRate(0.333)).toBe('33.3%');
    expect(formatFailureRate(0.125)).toBe('12.5%');
  });
});
