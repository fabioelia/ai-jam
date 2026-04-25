import { describe, it, expect } from 'vitest';
import {
  computeIdleScore,
  getIdleTier,
  getIdleTierLabel,
  formatIdleRatio,
  formatDurationMs,
} from '../agent-idle-time-tracker-service.js';

const ONE_HOUR = 3600000;

describe('computeIdleScore', () => {
  it('returns 0 for insufficient data (< 1 hour tracked)', () => {
    expect(computeIdleScore(0.1, 60000, ONE_HOUR - 1)).toBe(0);
  });

  it('scores optimally for ratio 0.0', () => {
    expect(computeIdleScore(0.0, 0, ONE_HOUR * 2)).toBe(90);
  });

  it('scores correctly at ratio 0.1', () => {
    const score = computeIdleScore(0.1, 60000, ONE_HOUR * 2);
    expect(score).toBeCloseTo(85, 0);
  });

  it('scores correctly at boundary ratio 0.2', () => {
    const score = computeIdleScore(0.2, 60000, ONE_HOUR * 2);
    expect(score).toBeCloseTo(80, 0);
  });

  it('scores in moderate range at ratio 0.3', () => {
    const score = computeIdleScore(0.3, 60000, ONE_HOUR * 2);
    expect(score).toBeGreaterThan(55);
    expect(score).toBeLessThan(80);
  });

  it('scores at boundary ratio 0.4', () => {
    const score = computeIdleScore(0.4, 60000, ONE_HOUR * 2);
    expect(score).toBeCloseTo(50, 0);
  });

  it('scores in declining range at ratio 0.55', () => {
    const score = computeIdleScore(0.55, 60000, ONE_HOUR * 2);
    expect(score).toBeGreaterThan(20);
    expect(score).toBeLessThan(50);
  });

  it('scores at boundary ratio 0.7', () => {
    const score = computeIdleScore(0.7, 60000, ONE_HOUR * 2);
    expect(score).toBeCloseTo(20, 0);
  });

  it('scores near 0 for high idle ratio 1.0', () => {
    const score = computeIdleScore(1.0, 60000, ONE_HOUR * 2);
    expect(score).toBe(0);
  });
});

describe('getIdleTier', () => {
  it('returns insufficient_data when tracked time < 1 hour', () => {
    expect(getIdleTier(85, ONE_HOUR - 1)).toBe('insufficient_data');
  });

  it('returns optimally_utilized for score >= 80', () => {
    expect(getIdleTier(90, ONE_HOUR * 2)).toBe('optimally_utilized');
    expect(getIdleTier(80, ONE_HOUR * 2)).toBe('optimally_utilized');
  });

  it('returns moderately_idle for score >= 55', () => {
    expect(getIdleTier(65, ONE_HOUR * 2)).toBe('moderately_idle');
    expect(getIdleTier(55, ONE_HOUR * 2)).toBe('moderately_idle');
  });

  it('returns highly_idle for score >= 30', () => {
    expect(getIdleTier(45, ONE_HOUR * 2)).toBe('highly_idle');
    expect(getIdleTier(30, ONE_HOUR * 2)).toBe('highly_idle');
  });

  it('returns critically_idle for score < 30', () => {
    expect(getIdleTier(0, ONE_HOUR * 2)).toBe('critically_idle');
    expect(getIdleTier(29, ONE_HOUR * 2)).toBe('critically_idle');
  });
});

describe('getIdleTierLabel', () => {
  it('maps all tiers to labels', () => {
    expect(getIdleTierLabel('optimally_utilized')).toBe('Optimally Utilized');
    expect(getIdleTierLabel('moderately_idle')).toBe('Moderately Idle');
    expect(getIdleTierLabel('highly_idle')).toBe('Highly Idle');
    expect(getIdleTierLabel('critically_idle')).toBe('Critically Idle');
    expect(getIdleTierLabel('insufficient_data')).toBe('Insufficient Data');
  });
});

describe('formatIdleRatio', () => {
  it('formats 0 as 0.0%', () => expect(formatIdleRatio(0)).toBe('0.0%'));
  it('formats 0.5 as 50.0%', () => expect(formatIdleRatio(0.5)).toBe('50.0%'));
  it('formats 1.0 as 100.0%', () => expect(formatIdleRatio(1.0)).toBe('100.0%'));
});

describe('formatDurationMs', () => {
  it('formats 0ms as 0m', () => expect(formatDurationMs(0)).toBe('0m'));
  it('formats 45 minutes', () => expect(formatDurationMs(2700000)).toBe('45m'));
  it('formats 2h 15m', () => expect(formatDurationMs(8100000)).toBe('2h 15m'));
  it('formats exact hours', () => expect(formatDurationMs(7200000)).toBe('2h'));
});
