import { describe, it, expect } from 'vitest';
import {
  computeDurationScore,
  getDurationTier,
  getDurationTierLabel,
  formatDuration,
} from '../agent-session-duration-analyzer-service.js';

describe('computeDurationScore', () => {
  it('returns 0 for insufficient sessions (< 2)', () => {
    expect(computeDurationScore(0, 0, 0)).toBe(0);
    expect(computeDurationScore(1, 60000, 120000)).toBe(0);
  });

  it('computes score for efficient agent with short sessions', () => {
    // sessions=10, avg=5min(300000ms), p95=10min(600000ms)
    // 10*4 + max(0,30-5)*1.5 + max(0,60-10)*0.5 = 40 + 37.5 + 25 = 102.5 → clamped to 100
    expect(computeDurationScore(10, 300000, 600000)).toBe(100);
  });

  it('computes score for slow agent with long sessions', () => {
    // sessions=5, avg=60min(3600000ms), p95=120min(7200000ms)
    // 5*4 + max(0,30-60)*1.5 + max(0,60-120)*0.5 = 20 + 0 + 0 = 20
    expect(computeDurationScore(5, 3600000, 7200000)).toBe(20);
  });

  it('clamps at 100', () => {
    expect(computeDurationScore(100, 0, 0)).toBe(100);
  });

  it('uses 1 decimal precision', () => {
    // sessions=2, avg=29min(1740000ms), p95=59min(3540000ms)
    // 2*4 + max(0,30-29)*1.5 + max(0,60-59)*0.5 = 8 + 1.5 + 0.5 = 10
    expect(computeDurationScore(2, 1740000, 3540000)).toBe(10);
  });

  it('handles avg > 30min (no avg bonus)', () => {
    // sessions=3, avg=45min(2700000ms), p95=30min(1800000ms)
    // 3*4 + max(0,30-45)*1.5 + max(0,60-30)*0.5 = 12 + 0 + 15 = 27
    expect(computeDurationScore(3, 2700000, 1800000)).toBe(27);
  });
});

describe('getDurationTier', () => {
  it('returns insufficient_data for < 2 valid sessions', () => {
    expect(getDurationTier(90, 0)).toBe('insufficient_data');
    expect(getDurationTier(90, 1)).toBe('insufficient_data');
  });

  it('returns high for score >= 70', () => {
    expect(getDurationTier(70, 5)).toBe('high');
    expect(getDurationTier(100, 5)).toBe('high');
  });

  it('returns moderate for score >= 35', () => {
    expect(getDurationTier(35, 5)).toBe('moderate');
    expect(getDurationTier(69, 5)).toBe('moderate');
  });

  it('returns low for score < 35', () => {
    expect(getDurationTier(0, 5)).toBe('low');
    expect(getDurationTier(34, 5)).toBe('low');
  });
});

describe('getDurationTierLabel', () => {
  it('maps tiers to correct labels', () => {
    expect(getDurationTierLabel('high')).toBe('Efficient');
    expect(getDurationTierLabel('moderate')).toBe('Typical');
    expect(getDurationTierLabel('low')).toBe('Slow');
    expect(getDurationTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatDuration', () => {
  it('formats < 1000ms as ms', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats >= 1000ms and < 60000ms as seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(5500)).toBe('5.5s');
    expect(formatDuration(59000)).toBe('59.0s');
  });

  it('formats >= 60000ms as minutes', () => {
    expect(formatDuration(60000)).toBe('1.0m');
    expect(formatDuration(90000)).toBe('1.5m');
    expect(formatDuration(3600000)).toBe('60.0m');
  });
});
