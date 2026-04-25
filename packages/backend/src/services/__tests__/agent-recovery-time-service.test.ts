import { describe, it, expect } from 'vitest';
import {
  computeRecoveryScore,
  getRecoveryTier,
  getRecoveryTierLabel,
  formatRecoveryTime,
} from '../agent-recovery-time-service.js';

describe('computeRecoveryScore', () => {
  it('returns 0 for insufficient data (totalTickets < 3)', () => {
    expect(computeRecoveryScore(0, 1.0, 0, 2)).toBe(0);
    expect(computeRecoveryScore(0, 1.0, 5, 1)).toBe(0);
  });

  it('returns 75 when no blocked tickets', () => {
    expect(computeRecoveryScore(0, 0, 0, 10)).toBe(75);
    expect(computeRecoveryScore(5, 0.8, 0, 10)).toBe(75);
  });

  it('computes fast recovery (0h, 100% success)', () => {
    // successComponent = 50, timeComponent = 50 → 100
    expect(computeRecoveryScore(0, 1.0, 3, 10)).toBe(100);
  });

  it('computes score at boundary avgTime=2h', () => {
    // successComponent = 50, timeComponent = 50 → 100
    expect(computeRecoveryScore(2, 1.0, 2, 10)).toBe(100);
  });

  it('computes slow recovery (12h, 80% success)', () => {
    // successComponent = 40, timeComponent = 25 - ((12-8)/16)*15 = 25 - 3.75 = 21.25 → 61.25
    expect(computeRecoveryScore(12, 0.8, 3, 10)).toBe(61.3);
  });

  it('computes chronic issues (48h, 0% success)', () => {
    // successComponent = 0, timeComponent = max(0, 10 - (48-24)/24*10) = max(0, 10-10) = 0 → 0
    expect(computeRecoveryScore(48, 0, 5, 10)).toBe(0);
  });

  it('clamps to 100 max', () => {
    // perfect recovery
    expect(computeRecoveryScore(0, 1.0, 1, 5)).toBe(100);
  });

  it('handles boundary at 8h', () => {
    // successComponent = 25, timeComponent = 25 → 50
    expect(computeRecoveryScore(8, 0.5, 2, 10)).toBe(50);
  });
});

describe('getRecoveryTier', () => {
  it('returns insufficient_data when totalTickets < 3', () => {
    expect(getRecoveryTier(90, 2)).toBe('insufficient_data');
    expect(getRecoveryTier(90, 0)).toBe('insufficient_data');
  });

  it('returns fast_recovery for score >= 70', () => {
    expect(getRecoveryTier(70, 5)).toBe('fast_recovery');
    expect(getRecoveryTier(100, 5)).toBe('fast_recovery');
  });

  it('returns slow_recovery for score >= 40 and < 70', () => {
    expect(getRecoveryTier(40, 5)).toBe('slow_recovery');
    expect(getRecoveryTier(69, 5)).toBe('slow_recovery');
  });

  it('returns chronic_issues for score < 40', () => {
    expect(getRecoveryTier(0, 5)).toBe('chronic_issues');
    expect(getRecoveryTier(39, 5)).toBe('chronic_issues');
  });
});

describe('getRecoveryTierLabel', () => {
  it('returns correct labels for all tiers', () => {
    expect(getRecoveryTierLabel('fast_recovery')).toBe('Fast Recovery');
    expect(getRecoveryTierLabel('slow_recovery')).toBe('Slow Recovery');
    expect(getRecoveryTierLabel('chronic_issues')).toBe('Chronic Issues');
    expect(getRecoveryTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatRecoveryTime', () => {
  it('formats < 1 hour as minutes', () => {
    expect(formatRecoveryTime(0.5)).toBe('30m');
    expect(formatRecoveryTime(0.25)).toBe('15m');
  });

  it('formats boundary 1.0h as hours', () => {
    expect(formatRecoveryTime(1.0)).toBe('1.0h');
  });

  it('formats hours between 1 and 24', () => {
    expect(formatRecoveryTime(2.5)).toBe('2.5h');
    expect(formatRecoveryTime(12)).toBe('12.0h');
  });

  it('formats boundary 24h as days', () => {
    expect(formatRecoveryTime(24)).toBe('1.0d');
  });

  it('formats multiple days', () => {
    expect(formatRecoveryTime(48)).toBe('2.0d');
    expect(formatRecoveryTime(72)).toBe('3.0d');
  });
});
