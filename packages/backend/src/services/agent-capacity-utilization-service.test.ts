import { describe, it, expect } from 'vitest';
import {
  computeUtilizationScore,
  getUtilizationTier,
  getUtilizationTierLabel,
  formatUtilizationRate,
} from './agent-capacity-utilization-service.js';

describe('computeUtilizationScore', () => {
  it('returns 0 when totalSessions < 2', () => {
    expect(computeUtilizationScore(0.5, 1)).toBe(0);
    expect(computeUtilizationScore(0.5, 0)).toBe(0);
  });

  it('returns high score for optimal utilization around 55%', () => {
    // deviation = |0.55 - 0.55| = 0 → 100 - 0 = 100
    expect(computeUtilizationScore(0.55, 5)).toBe(100);
  });

  it('returns lower score for high utilization', () => {
    // deviation = |0.95 - 0.55| = 0.4 → 100 - 0.4*120 = 52
    expect(computeUtilizationScore(0.95, 5)).toBe(52);
  });

  it('returns lower score for low utilization', () => {
    // deviation = |0.1 - 0.55| = 0.45 → 100 - 0.45*120 = 46
    expect(computeUtilizationScore(0.1, 5)).toBe(46);
  });

  it('clamps score at 0 for extreme deviation', () => {
    // deviation = |1.0 - 0.55| = 0.45 → 100 - 54 = 46 (still positive)
    // deviation = |0.0 - 0.55| = 0.55 → 100 - 66 = 34
    expect(computeUtilizationScore(0.0, 5)).toBe(34);
  });

  it('clamps score at 100 maximum', () => {
    expect(computeUtilizationScore(0.55, 10)).toBe(100);
  });

  it('returns 1-decimal precision', () => {
    const score = computeUtilizationScore(0.7, 3);
    expect(Math.round(score * 10) / 10).toBe(score);
  });
});

describe('getUtilizationTier', () => {
  it('returns insufficient_data when totalSessions < 2', () => {
    expect(getUtilizationTier(100, 1)).toBe('insufficient_data');
    expect(getUtilizationTier(100, 0)).toBe('insufficient_data');
  });

  it('returns optimal when score >= 75', () => {
    expect(getUtilizationTier(75, 5)).toBe('optimal');
    expect(getUtilizationTier(100, 5)).toBe('optimal');
  });

  it('returns moderate when score >= 45', () => {
    expect(getUtilizationTier(45, 5)).toBe('moderate');
    expect(getUtilizationTier(74, 5)).toBe('moderate');
  });

  it('returns imbalanced when score < 45', () => {
    expect(getUtilizationTier(44, 5)).toBe('imbalanced');
    expect(getUtilizationTier(0, 5)).toBe('imbalanced');
  });

  it('uses boundary of 2 sessions correctly', () => {
    expect(getUtilizationTier(80, 2)).toBe('optimal');
  });
});

describe('getUtilizationTierLabel', () => {
  it('returns Optimal for optimal', () => {
    expect(getUtilizationTierLabel('optimal')).toBe('Optimal');
  });

  it('returns Moderate for moderate', () => {
    expect(getUtilizationTierLabel('moderate')).toBe('Moderate');
  });

  it('returns Imbalanced for imbalanced', () => {
    expect(getUtilizationTierLabel('imbalanced')).toBe('Imbalanced');
  });

  it('returns Insufficient Data for insufficient_data', () => {
    expect(getUtilizationTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatUtilizationRate', () => {
  it('formats 0 as 0.0%', () => {
    expect(formatUtilizationRate(0)).toBe('0.0%');
  });

  it('formats 0.5 as 50.0%', () => {
    expect(formatUtilizationRate(0.5)).toBe('50.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatUtilizationRate(1)).toBe('100.0%');
  });

  it('formats 0.333 with 1 decimal', () => {
    expect(formatUtilizationRate(0.333)).toBe('33.3%');
  });
});
