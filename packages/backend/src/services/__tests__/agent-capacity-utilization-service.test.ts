import { describe, it, expect } from 'vitest';
import {
  computeUtilizationScore,
  getUtilizationTier,
  getUtilizationTierLabel,
  formatUtilizationRate,
} from '../agent-capacity-utilization-service.js';

describe('computeUtilizationScore', () => {
  it('returns 0 when totalSessions < 2', () => {
    expect(computeUtilizationScore(0.55, 1)).toBe(0);
    expect(computeUtilizationScore(0.55, 0)).toBe(0);
  });

  it('returns 100 when rate = 0.55 (ideal)', () => {
    // deviation = 0, score = 100
    expect(computeUtilizationScore(0.55, 5)).toBe(100);
  });

  it('computes score for rate = 0', () => {
    // deviation = 0.55, score = 100 - 0.55*120 = 100 - 66 = 34
    expect(computeUtilizationScore(0, 5)).toBe(34);
  });

  it('computes score for rate = 1.0', () => {
    // deviation = 0.45, score = 100 - 0.45*120 = 100 - 54 = 46
    expect(computeUtilizationScore(1.0, 5)).toBe(46);
  });

  it('clamps score at 0 when deviation is very large', () => {
    // deviation > 100/120 causes negative → clamped to 0
    // rate = 1.5 (hypothetical) → deviation = 0.95, score = 100 - 114 = -14 → 0
    expect(computeUtilizationScore(1.5, 5)).toBe(0);
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
});

describe('getUtilizationTierLabel', () => {
  it('returns correct label for optimal', () => {
    expect(getUtilizationTierLabel('optimal')).toBe('Optimal');
  });

  it('returns correct label for moderate', () => {
    expect(getUtilizationTierLabel('moderate')).toBe('Moderate');
  });

  it('returns correct label for imbalanced', () => {
    expect(getUtilizationTierLabel('imbalanced')).toBe('Imbalanced');
  });

  it('returns correct label for insufficient_data', () => {
    expect(getUtilizationTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatUtilizationRate', () => {
  it('formats 0.456 as 45.6%', () => {
    expect(formatUtilizationRate(0.456)).toBe('45.6%');
  });

  it('formats 1.0 as 100.0%', () => {
    expect(formatUtilizationRate(1.0)).toBe('100.0%');
  });

  it('formats 0 as 0.0%', () => {
    expect(formatUtilizationRate(0)).toBe('0.0%');
  });
});
