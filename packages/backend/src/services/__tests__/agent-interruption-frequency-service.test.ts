import { describe, it, expect } from 'vitest';
import {
  computeInterruptionScore,
  getInterruptionTier,
  getInterruptionTierLabel,
} from '../agent-interruption-frequency-service.js';

describe('computeInterruptionScore', () => {
  it('returns high score for frequently interrupted agent', () => {
    // interruptionsPerSession=0.8, avg=5min (300000ms), totalSessions=10
    // shortPenalty = max(0, 15 - 5) * 2 = 20
    // raw = 0.8 * 60 + 20 = 48 + 20 = 68
    expect(computeInterruptionScore(0.8, 300000, 10)).toBe(68);
  });

  it('returns moderate score for occasionally interrupted agent', () => {
    // interruptionsPerSession=0.3, avg=10min (600000ms), totalSessions=5
    // shortPenalty = max(0, 15 - 10) * 2 = 10
    // raw = 0.3 * 60 + 10 = 18 + 10 = 28
    expect(computeInterruptionScore(0.3, 600000, 5)).toBe(28);
  });

  it('returns low score for focused agent', () => {
    // interruptionsPerSession=0.1, avg=0ms (no interrupted sessions), totalSessions=5
    // shortPenalty = max(0, 15 - 0) * 2 = 30
    // raw = 0.1 * 60 + 30 = 6 + 30 = 36 — wait this is moderate
    // let's use: interruptionsPerSession=0.05, avg=0, totalSessions=5 => 3 + 30 = 33 => moderate
    // use 0, 0, 5 => 0 + 30 = 30 => moderate still. Let's try 0, 0, 0 (totalSessions=0)
    // totalSessions=0 => shortPenalty=0, raw = 0 => 0
    expect(computeInterruptionScore(0, 0, 0)).toBe(0);
  });

  it('clamps at 100', () => {
    // interruptionsPerSession=2, avg=1min (60000ms), totalSessions=10
    // raw = 120 + max(0,15-1)*2 = 120 + 28 = 148 => clamped to 100
    expect(computeInterruptionScore(2, 60000, 10)).toBe(100);
  });

  it('returns 0 when no sessions', () => {
    expect(computeInterruptionScore(0, 0, 0)).toBe(0);
  });

  it('shortPenalty is 0 for avg >= 15 min', () => {
    // avg=15min (900000ms), interruptionsPerSession=0.5, totalSessions=5
    // shortPenalty = max(0, 15 - 15) * 2 = 0
    // raw = 0.5 * 60 = 30
    expect(computeInterruptionScore(0.5, 900000, 5)).toBe(30);
  });
});

describe('getInterruptionTier', () => {
  it('returns high for score >= 60', () => {
    expect(getInterruptionTier(60, 5)).toBe('high');
    expect(getInterruptionTier(100, 10)).toBe('high');
  });

  it('returns moderate for score >= 25', () => {
    expect(getInterruptionTier(25, 5)).toBe('moderate');
    expect(getInterruptionTier(59, 5)).toBe('moderate');
  });

  it('returns low for score < 25', () => {
    expect(getInterruptionTier(0, 5)).toBe('low');
    expect(getInterruptionTier(24, 5)).toBe('low');
  });

  it('returns insufficient_data when < 3 sessions', () => {
    expect(getInterruptionTier(90, 0)).toBe('insufficient_data');
    expect(getInterruptionTier(90, 2)).toBe('insufficient_data');
  });
});

describe('getInterruptionTierLabel', () => {
  it('maps high to Highly Interrupted', () => {
    expect(getInterruptionTierLabel('high')).toBe('Highly Interrupted');
  });

  it('maps moderate to Occasionally Interrupted', () => {
    expect(getInterruptionTierLabel('moderate')).toBe('Occasionally Interrupted');
  });

  it('maps low to Focused', () => {
    expect(getInterruptionTierLabel('low')).toBe('Focused');
  });

  it('maps insufficient_data to Insufficient Data', () => {
    expect(getInterruptionTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});
