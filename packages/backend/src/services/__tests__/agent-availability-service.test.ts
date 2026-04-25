import { describe, it, expect } from 'vitest';
import { computeAvailabilityScore, getAvailabilityTier, getAvailabilityTierLabel, formatHours } from '../agent-availability-service.js';

describe('computeAvailabilityScore', () => {
  it('returns 0 when totalSessions < 2', () => {
    expect(computeAvailabilityScore(0, 10, 5)).toBe(0);
    expect(computeAvailabilityScore(1, 10, 5)).toBe(0);
  });

  it('returns single session as 0', () => {
    expect(computeAvailabilityScore(1, 100, 0)).toBe(0);
  });

  it('computes high score and clamps to 100', () => {
    // 20*3=60, min(40,30*2)=40, max(0,20-2)=18 → 118 → clamped to 100
    expect(computeAvailabilityScore(20, 30, 2)).toBe(100);
  });

  it('computes moderate score correctly', () => {
    // 5*3=15, min(40,5*2)=10, max(0,20-10)=10 → 35
    expect(computeAvailabilityScore(5, 5, 10)).toBe(35);
  });

  it('computes low score correctly', () => {
    // 3*3=9, min(40,1*2)=2, max(0,20-25)=0 → 11
    expect(computeAvailabilityScore(3, 1, 25)).toBe(11);
  });

  it('computes score with zero active hours and zero gap', () => {
    // 2*3=6, min(40,0)=0, max(0,20-0)=20 → 26
    expect(computeAvailabilityScore(2, 0, 0)).toBe(26);
  });
});

describe('getAvailabilityTier', () => {
  it('returns insufficient_data when totalSessions < 2', () => {
    expect(getAvailabilityTier(100, 1)).toBe('insufficient_data');
    expect(getAvailabilityTier(100, 0)).toBe('insufficient_data');
  });

  it('returns high when score >= 70', () => {
    expect(getAvailabilityTier(70, 5)).toBe('high');
    expect(getAvailabilityTier(100, 5)).toBe('high');
  });

  it('returns moderate when score >= 35 and < 70', () => {
    expect(getAvailabilityTier(35, 5)).toBe('moderate');
    expect(getAvailabilityTier(69, 5)).toBe('moderate');
  });

  it('returns low when score < 35', () => {
    expect(getAvailabilityTier(34, 5)).toBe('low');
    expect(getAvailabilityTier(0, 5)).toBe('low');
  });
});

describe('getAvailabilityTierLabel', () => {
  it('returns correct label for high', () => {
    expect(getAvailabilityTierLabel('high')).toBe('Highly Available');
  });

  it('returns correct label for moderate', () => {
    expect(getAvailabilityTierLabel('moderate')).toBe('Moderately Available');
  });

  it('returns correct label for low', () => {
    expect(getAvailabilityTierLabel('low')).toBe('Low Availability');
  });

  it('returns correct label for insufficient_data', () => {
    expect(getAvailabilityTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatHours', () => {
  it('formats sub-hour values in minutes', () => {
    expect(formatHours(0.5)).toBe('30m');
  });

  it('formats hours with decimal', () => {
    expect(formatHours(2.5)).toBe('2.5h');
  });

  it('formats 48 hours as days', () => {
    expect(formatHours(48)).toBe('2.0d');
  });
});
