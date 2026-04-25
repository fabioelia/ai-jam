import { describe, it, expect } from 'vitest';
import {
  computeSaturationScore,
  getSaturationTier,
  getSaturationTierLabel,
  formatSaturationRate,
} from '../agent-workload-saturation-service.js';

describe('computeSaturationScore', () => {
  it('returns 0 for insufficient data (totalTickets < 2)', () => {
    expect(computeSaturationScore(0.5, 1)).toBe(0);
    expect(computeSaturationScore(1.0, 0)).toBe(0);
  });

  it('computes underutilized score (rate=0.2)', () => {
    // 0.2 * 60 = 12
    expect(computeSaturationScore(0.2, 5)).toBe(12);
  });

  it('computes score at boundary rate=0.5', () => {
    // 0.5 * 60 = 30
    expect(computeSaturationScore(0.5, 5)).toBe(30);
  });

  it('computes healthy score (rate=0.75)', () => {
    // 30 + (0.75-0.5)*80 = 30 + 20 = 50
    expect(computeSaturationScore(0.75, 5)).toBe(50);
  });

  it('computes score at boundary rate=1.0', () => {
    // 30 + (1.0-0.5)*80 = 30 + 40 = 70
    expect(computeSaturationScore(1.0, 5)).toBe(70);
  });

  it('computes saturated score (rate=1.5)', () => {
    // 70 + (1.5-1.0)*30 = 70 + 15 = 85
    expect(computeSaturationScore(1.5, 5)).toBe(85);
  });

  it('clamps to 100 for very high rates', () => {
    // 70 + (2.0-1.0)*30 = 100
    expect(computeSaturationScore(2.0, 5)).toBe(100);
  });

  it('returns 0 for zero rate with sufficient data', () => {
    expect(computeSaturationScore(0, 5)).toBe(0);
  });
});

describe('getSaturationTier', () => {
  it('returns insufficient_data when totalTickets < 2', () => {
    expect(getSaturationTier(90, 1)).toBe('insufficient_data');
    expect(getSaturationTier(90, 0)).toBe('insufficient_data');
  });

  it('returns overloaded for score >= 85', () => {
    expect(getSaturationTier(85, 5)).toBe('overloaded');
    expect(getSaturationTier(100, 5)).toBe('overloaded');
  });

  it('returns saturated for score >= 60 and < 85', () => {
    expect(getSaturationTier(60, 5)).toBe('saturated');
    expect(getSaturationTier(84, 5)).toBe('saturated');
  });

  it('returns healthy for score >= 30 and < 60', () => {
    expect(getSaturationTier(30, 5)).toBe('healthy');
    expect(getSaturationTier(59, 5)).toBe('healthy');
  });

  it('returns underutilized for score < 30', () => {
    expect(getSaturationTier(0, 5)).toBe('underutilized');
    expect(getSaturationTier(29, 5)).toBe('underutilized');
  });
});

describe('getSaturationTierLabel', () => {
  it('returns correct labels for all tiers', () => {
    expect(getSaturationTierLabel('overloaded')).toBe('Overloaded');
    expect(getSaturationTierLabel('saturated')).toBe('Saturated');
    expect(getSaturationTierLabel('healthy')).toBe('Healthy');
    expect(getSaturationTierLabel('underutilized')).toBe('Underutilized');
    expect(getSaturationTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatSaturationRate', () => {
  it('formats 0 as 0.0%', () => {
    expect(formatSaturationRate(0)).toBe('0.0%');
  });

  it('formats 1.0 as 100.0%', () => {
    expect(formatSaturationRate(1.0)).toBe('100.0%');
  });

  it('formats 0.75 as 75.0%', () => {
    expect(formatSaturationRate(0.75)).toBe('75.0%');
  });

  it('formats 0.333 with one decimal', () => {
    expect(formatSaturationRate(0.333)).toBe('33.3%');
  });
});
