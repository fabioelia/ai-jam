import { describe, it, expect } from 'vitest';
import {
  computeVariabilityScore,
  getVariabilityTier,
  getVariabilityTierLabel,
  formatCV,
} from './agent-throughput-variability-service.js';

describe('computeVariabilityScore', () => {
  it('returns 0 when totalTicketsAnalyzed < 3', () => {
    expect(computeVariabilityScore(0.5, 2)).toBe(0);
    expect(computeVariabilityScore(0.5, 0)).toBe(0);
  });

  it('returns high score for low CV (consistent throughput)', () => {
    // cv=0 → 100 - 0*80 = 100
    expect(computeVariabilityScore(0, 10)).toBe(100);
  });

  it('returns lower score for higher CV', () => {
    // cv=0.5 → 100 - 0.5*80 = 60
    expect(computeVariabilityScore(0.5, 10)).toBe(60);
  });

  it('returns 0 for very high CV', () => {
    // cv=1.5 → 100 - 1.5*80 = -20 → clamped to 0
    expect(computeVariabilityScore(1.5, 10)).toBe(0);
  });

  it('clamps score at 100 maximum', () => {
    expect(computeVariabilityScore(0, 20)).toBe(100);
  });

  it('computes erratic case correctly', () => {
    // cv=1.0 → 100 - 80 = 20
    expect(computeVariabilityScore(1.0, 5)).toBe(20);
  });

  it('returns 1-decimal precision', () => {
    const score = computeVariabilityScore(0.3, 5);
    expect(Math.round(score * 10) / 10).toBe(score);
  });
});

describe('getVariabilityTier', () => {
  it('returns insufficient_data when totalTicketsAnalyzed < 3', () => {
    expect(getVariabilityTier(100, 2)).toBe('insufficient_data');
    expect(getVariabilityTier(100, 0)).toBe('insufficient_data');
  });

  it('returns stable when score >= 75', () => {
    expect(getVariabilityTier(75, 5)).toBe('stable');
    expect(getVariabilityTier(100, 5)).toBe('stable');
  });

  it('returns moderate when score >= 45', () => {
    expect(getVariabilityTier(45, 5)).toBe('moderate');
    expect(getVariabilityTier(74, 5)).toBe('moderate');
  });

  it('returns erratic when score < 45', () => {
    expect(getVariabilityTier(44, 5)).toBe('erratic');
    expect(getVariabilityTier(0, 5)).toBe('erratic');
  });

  it('uses boundary of 3 tickets correctly', () => {
    expect(getVariabilityTier(80, 3)).toBe('stable');
  });
});

describe('getVariabilityTierLabel', () => {
  it('returns Stable for stable', () => {
    expect(getVariabilityTierLabel('stable')).toBe('Stable');
  });

  it('returns Moderate for moderate', () => {
    expect(getVariabilityTierLabel('moderate')).toBe('Moderate');
  });

  it('returns Erratic for erratic', () => {
    expect(getVariabilityTierLabel('erratic')).toBe('Erratic');
  });

  it('returns Insufficient Data for insufficient_data', () => {
    expect(getVariabilityTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatCV', () => {
  it('formats 0 as 0.0%', () => {
    expect(formatCV(0)).toBe('0.0%');
  });

  it('formats 0.5 as 50.0%', () => {
    expect(formatCV(0.5)).toBe('50.0%');
  });

  it('formats 1 as 100.0%', () => {
    expect(formatCV(1)).toBe('100.0%');
  });

  it('formats 0.123 with 1 decimal place', () => {
    expect(formatCV(0.123)).toBe('12.3%');
  });
});
