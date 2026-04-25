import { describe, it, expect } from 'vitest';
import {
  computeAvailabilityScore,
  getAvailabilityTier,
  getAvailabilityTierLabel,
  formatHours,
} from './agent-availability-service.js';

describe('computeAvailabilityScore', () => {
  it('returns 0 for agent with fewer than 2 sessions', () => {
    expect(computeAvailabilityScore(1, 10, 5)).toBe(0);
    expect(computeAvailabilityScore(0, 0, 0)).toBe(0);
  });

  it('accumulates score from sessions and active hours', () => {
    // 5*3 + min(40, 5*2) + max(0, 20-2) = 15 + 10 + 18 = 43
    expect(computeAvailabilityScore(5, 5, 2)).toBe(43);
  });

  it('caps active hours contribution at 40', () => {
    // 5*3 + 40 + max(0, 20-5) = 15 + 40 + 15 = 70
    expect(computeAvailabilityScore(5, 30, 5)).toBe(70);
  });

  it('does not deduct gap bonus below zero', () => {
    // 5*3 + min(40, 2*2) + max(0, 20-100) = 15 + 4 + 0 = 19
    expect(computeAvailabilityScore(5, 2, 100)).toBe(19);
  });

  it('clamps at 100 maximum', () => {
    // very high sessions: 34*3 + 40 + 20 = 162 → clamped to 100
    expect(computeAvailabilityScore(34, 30, 0)).toBe(100);
  });

  it('returns 1-decimal precision', () => {
    const score = computeAvailabilityScore(3, 1, 3);
    expect(Math.round(score * 10) / 10).toBe(score);
  });
});

describe('getAvailabilityTier', () => {
  it('returns insufficient_data when totalSessions < 2', () => {
    expect(getAvailabilityTier(100, 0)).toBe('insufficient_data');
    expect(getAvailabilityTier(100, 1)).toBe('insufficient_data');
  });

  it('returns high for score >= 70', () => {
    expect(getAvailabilityTier(70, 5)).toBe('high');
    expect(getAvailabilityTier(100, 5)).toBe('high');
  });

  it('returns moderate for score >= 35', () => {
    expect(getAvailabilityTier(35, 5)).toBe('moderate');
    expect(getAvailabilityTier(69, 5)).toBe('moderate');
  });

  it('returns low for score < 35', () => {
    expect(getAvailabilityTier(0, 5)).toBe('low');
    expect(getAvailabilityTier(34, 5)).toBe('low');
  });

  it('uses boundary 2 sessions correctly', () => {
    expect(getAvailabilityTier(90, 2)).toBe('high');
  });
});

describe('getAvailabilityTierLabel', () => {
  it('maps all tiers to correct labels', () => {
    expect(getAvailabilityTierLabel('high')).toBe('Highly Available');
    expect(getAvailabilityTierLabel('moderate')).toBe('Moderately Available');
    expect(getAvailabilityTierLabel('low')).toBe('Low Availability');
    expect(getAvailabilityTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatHours', () => {
  it('formats sub-hour as minutes', () => {
    expect(formatHours(0.5)).toBe('30m');
  });

  it('formats hours range', () => {
    expect(formatHours(2.5)).toBe('2.5h');
  });

  it('formats >= 24h as days', () => {
    expect(formatHours(48)).toBe('2.0d');
  });

  it('formats exactly 1h as hours', () => {
    expect(formatHours(1)).toBe('1.0h');
  });
});
