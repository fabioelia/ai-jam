import { describe, it, expect } from 'vitest';
import {
  computeVariabilityScore,
  getVariabilityTier,
  getVariabilityTierLabel,
  formatCV,
} from '../agent-throughput-variability-service.js';

describe('computeVariabilityScore', () => {
  it('returns 0 when totalTicketsAnalyzed < 3', () => {
    expect(computeVariabilityScore(0, 2)).toBe(0);
    expect(computeVariabilityScore(0, 0)).toBe(0);
  });

  it('returns 100 when cv = 0', () => {
    expect(computeVariabilityScore(0, 5)).toBe(100);
  });

  it('clamps to 0 when cv = 1.5', () => {
    // 100 - 1.5*80 = 100 - 120 = -20 → 0
    expect(computeVariabilityScore(1.5, 5)).toBe(0);
  });

  it('computes score with 1 decimal for cv = 0.25', () => {
    // 100 - 0.25*80 = 100 - 20 = 80
    expect(computeVariabilityScore(0.25, 5)).toBe(80);
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
});

describe('getVariabilityTierLabel', () => {
  it('returns correct label for stable', () => {
    expect(getVariabilityTierLabel('stable')).toBe('Stable');
  });

  it('returns correct label for moderate', () => {
    expect(getVariabilityTierLabel('moderate')).toBe('Moderate');
  });

  it('returns correct label for erratic', () => {
    expect(getVariabilityTierLabel('erratic')).toBe('Erratic');
  });

  it('returns correct label for insufficient_data', () => {
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

  it('formats 1.25 as 125.0%', () => {
    expect(formatCV(1.25)).toBe('125.0%');
  });
});
