import { describe, it, expect } from 'vitest';
import {
  computeGapScore,
  getGapTier,
  getGapTierLabel,
  formatGapScore,
} from '../agent-knowledge-gap-analyzer-service.js';

describe('computeGapScore', () => {
  it('returns 0 for insufficient data (totalTickets < 3)', () => {
    expect(computeGapScore(0, 5, 1.0, 2)).toBe(0);
    expect(computeGapScore(0, 5, 1.0, 1)).toBe(0);
    expect(computeGapScore(0, 5, 1.0, 0)).toBe(0);
  });

  it('computes score for no gaps and 100% completion', () => {
    // gapRatio=0, completionBonus=40, gapPenalty=0 → score = 40 + 60 = 100
    expect(computeGapScore(0, 5, 1.0, 10)).toBe(100);
  });

  it('computes score for no gaps and 0% completion', () => {
    // gapRatio=0, completionBonus=0, gapPenalty=0 → score = 0 + 60 = 60
    expect(computeGapScore(0, 5, 0, 10)).toBe(60);
  });

  it('computes score for all gaps and 0% completion', () => {
    // gapRatio=1, completionBonus=0, gapPenalty=60 → score = max(0, 0 + (60-60)) = 0
    expect(computeGapScore(5, 5, 0, 10)).toBe(0);
  });

  it('computes score for partial gaps (half) with 50% completion', () => {
    // gapRatio=0.5, completionBonus=20, gapPenalty=30 → score = 20 + (60-30) = 50
    expect(computeGapScore(2, 4, 0.5, 10)).toBe(50);
  });

  it('clamps to 100 max', () => {
    expect(computeGapScore(0, 1, 1.0, 10)).toBe(100);
  });

  it('clamps to 0 min', () => {
    // Worst case: all gaps, 0 completion → max(0, ...) ensures no negatives
    expect(computeGapScore(10, 5, 0, 10)).toBe(0);
  });
});

describe('getGapTier', () => {
  it('returns insufficient_data when totalTickets < 3', () => {
    expect(getGapTier(90, 2)).toBe('insufficient_data');
    expect(getGapTier(90, 0)).toBe('insufficient_data');
  });

  it('returns proficient for score >= 75', () => {
    expect(getGapTier(75, 5)).toBe('proficient');
    expect(getGapTier(100, 5)).toBe('proficient');
  });

  it('returns minor_gaps for score >= 45 and < 75', () => {
    expect(getGapTier(45, 5)).toBe('minor_gaps');
    expect(getGapTier(74, 5)).toBe('minor_gaps');
  });

  it('returns critical_gaps for score < 45', () => {
    expect(getGapTier(0, 5)).toBe('critical_gaps');
    expect(getGapTier(44, 5)).toBe('critical_gaps');
  });
});

describe('getGapTierLabel', () => {
  it('returns correct labels for all tiers', () => {
    expect(getGapTierLabel('proficient')).toBe('Proficient');
    expect(getGapTierLabel('minor_gaps')).toBe('Minor Gaps');
    expect(getGapTierLabel('critical_gaps')).toBe('Critical Gaps');
    expect(getGapTierLabel('insufficient_data')).toBe('Insufficient Data');
  });

  it('returns Insufficient Data for unknown tier', () => {
    expect(getGapTierLabel('unknown')).toBe('Insufficient Data');
  });
});

describe('formatGapScore', () => {
  it('formats score with 1 decimal place', () => {
    expect(formatGapScore(0)).toBe('0.0');
    expect(formatGapScore(100)).toBe('100.0');
    expect(formatGapScore(75)).toBe('75.0');
  });

  it('formats fractional scores correctly', () => {
    expect(formatGapScore(55.5)).toBe('55.5');
    expect(formatGapScore(33.3)).toBe('33.3');
    expect(formatGapScore(99.9)).toBe('99.9');
  });
});
