import { describe, it, expect } from 'vitest';
import {
  computeLagScore,
  getLagTier,
  getLagTierLabel,
  formatLagHours,
} from './agent-response-lag-service.js';

describe('computeLagScore', () => {
  it('returns 0 when totalTicketsAnalyzed < 2', () => {
    expect(computeLagScore(0, 0, 1)).toBe(0);
    expect(computeLagScore(0, 0, 0)).toBe(0);
  });

  it('computes fast case correctly', () => {
    // avgLag=0, slowTickets=0, total=5 → 100 - 0 - 0 = 100
    expect(computeLagScore(0, 0, 5)).toBe(100);
  });

  it('computes slow case and clamps to 0', () => {
    // avgLag=15, slowTickets=5, total=5 → 100 - 75 - 30 = -5 → 0
    expect(computeLagScore(15, 5, 5)).toBe(0);
  });

  it('computes moderate case correctly', () => {
    // avgLag=5, slowTickets=1, total=5 → 100 - 25 - 6 = 69
    expect(computeLagScore(5, 1, 5)).toBe(69);
  });

  it('clamps minimum at 0', () => {
    expect(computeLagScore(100, 10, 10)).toBe(0);
  });

  it('clamps maximum at 100', () => {
    expect(computeLagScore(0, 0, 10)).toBe(100);
  });

  it('returns 1-decimal precision', () => {
    const score = computeLagScore(3, 2, 5);
    expect(Math.round(score * 10) / 10).toBe(score);
  });
});

describe('getLagTier', () => {
  it('returns insufficient_data when totalTicketsAnalyzed < 2', () => {
    expect(getLagTier(100, 1)).toBe('insufficient_data');
    expect(getLagTier(100, 0)).toBe('insufficient_data');
  });

  it('returns fast when score >= 80', () => {
    expect(getLagTier(80, 5)).toBe('fast');
    expect(getLagTier(100, 5)).toBe('fast');
  });

  it('returns moderate when score >= 50', () => {
    expect(getLagTier(50, 5)).toBe('moderate');
    expect(getLagTier(79, 5)).toBe('moderate');
  });

  it('returns slow when score < 50', () => {
    expect(getLagTier(49, 5)).toBe('slow');
    expect(getLagTier(0, 5)).toBe('slow');
  });

  it('uses boundary of 2 correctly', () => {
    expect(getLagTier(90, 2)).toBe('fast');
  });
});

describe('getLagTierLabel', () => {
  it('returns correct label for fast', () => {
    expect(getLagTierLabel('fast')).toBe('Fast Responder');
  });

  it('returns correct label for moderate', () => {
    expect(getLagTierLabel('moderate')).toBe('Moderate');
  });

  it('returns correct label for slow', () => {
    expect(getLagTierLabel('slow')).toBe('Slow Responder');
  });

  it('returns correct label for insufficient_data', () => {
    expect(getLagTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatLagHours', () => {
  it('formats sub-hour as minutes', () => {
    expect(formatLagHours(0.5)).toBe('30m');
  });

  it('formats 1.5h correctly', () => {
    expect(formatLagHours(1.5)).toBe('1.5h');
  });

  it('formats 2h correctly', () => {
    expect(formatLagHours(2)).toBe('2.0h');
  });
});
