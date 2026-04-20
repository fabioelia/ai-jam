import { describe, it, expect } from 'vitest';
import {
  computeDecisionLatencyScore,
  getDecisionLatencyTier,
} from '../agent-decision-latency-service.js';

describe('computeDecisionLatencyScore', () => {
  it('computes base score from ratio', () => {
    // avg=60000, max=120000 → base = 100 - (60000/120000)*80 = 60
    const score = computeDecisionLatencyScore(60000, 120000);
    expect(score).toBe(60);
  });

  it('applies bonus for latency < 30s', () => {
    // avg=10000 (10s) < 30000 → bonus +10
    // base = 100 - (10000/120000)*80 ≈ 93.3 → +10 = 103.3 → clamped 100
    const score = computeDecisionLatencyScore(10000, 120000);
    expect(score).toBe(100);
  });

  it('applies penalty for latency > 5min', () => {
    // avg=360000 (6min) > 300000 → penalty -15
    // base = 100 - (360000/360000)*80 = 20, -15 = 5
    const score = computeDecisionLatencyScore(360000, 360000);
    expect(score).toBe(5);
  });

  it('clamps score to 0 minimum', () => {
    // avg=360000, max=100 → base = huge negative, clamped to 0
    const score = computeDecisionLatencyScore(360000, 100);
    expect(score).toBe(0);
  });

  it('returns 50 when maxObservedLatency is 0', () => {
    const score = computeDecisionLatencyScore(0, 0);
    expect(score).toBe(50);
  });
});

describe('getDecisionLatencyTier', () => {
  it('returns swift for score >= 80', () => {
    expect(getDecisionLatencyTier(80)).toBe('swift');
    expect(getDecisionLatencyTier(100)).toBe('swift');
  });

  it('returns prompt for score 60-79', () => {
    expect(getDecisionLatencyTier(60)).toBe('prompt');
    expect(getDecisionLatencyTier(79)).toBe('prompt');
  });

  it('returns deliberate for score 40-59', () => {
    expect(getDecisionLatencyTier(40)).toBe('deliberate');
    expect(getDecisionLatencyTier(59)).toBe('deliberate');
  });

  it('returns sluggish for score < 40', () => {
    expect(getDecisionLatencyTier(39)).toBe('sluggish');
    expect(getDecisionLatencyTier(0)).toBe('sluggish');
  });
});
