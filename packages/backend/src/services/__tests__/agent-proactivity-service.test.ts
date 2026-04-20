import { describe, it, expect } from 'vitest';
import {
  computeProactivityScore,
  getProactivityTier,
} from '../agent-proactivity-service.js';

// ─── computeProactivityScore ──────────────────────────────────────────────────

describe('computeProactivityScore', () => {
  it('returns 0 when totalTasks is 0', () => {
    expect(computeProactivityScore(0, 0, 0, 0, 0)).toBe(0);
  });

  it('returns a positive score when agent creates tickets', () => {
    // ticketsCreated=5, totalTasks=5 → full initiation ratio → 50 initiation pts
    // no proactive actions → 0 engagement pts
    // volumePoints = min((5/10)*20, 20) = 10
    const score = computeProactivityScore(5, 5, 0, 0, 0);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores higher when agent creates more tickets', () => {
    const low = computeProactivityScore(1, 10, 0, 0, 0);
    const high = computeProactivityScore(8, 10, 0, 0, 0);
    expect(high).toBeGreaterThan(low);
  });

  it('unprompted notes increase the score', () => {
    const without = computeProactivityScore(2, 10, 0, 0, 0);
    const with_ = computeProactivityScore(2, 10, 5, 0, 0);
    expect(with_).toBeGreaterThan(without);
  });

  it('blocker flags increase the score', () => {
    const without = computeProactivityScore(2, 10, 0, 0, 0);
    const with_ = computeProactivityScore(2, 10, 0, 5, 0);
    expect(with_).toBeGreaterThan(without);
  });

  it('suggestions increase the score', () => {
    const without = computeProactivityScore(2, 10, 0, 0, 0);
    const with_ = computeProactivityScore(2, 10, 0, 0, 5);
    expect(with_).toBeGreaterThan(without);
  });

  it('clamps score to maximum of 100', () => {
    const score = computeProactivityScore(100, 100, 100, 100, 100);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('clamps score to minimum of 0', () => {
    const score = computeProactivityScore(0, 1, 0, 0, 0);
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('returns integer (rounded) value', () => {
    const score = computeProactivityScore(3, 7, 2, 1, 1);
    expect(Number.isInteger(score)).toBe(true);
  });

  it('volume bonus increases score for high task counts', () => {
    const low = computeProactivityScore(0, 1, 0, 0, 0);
    const high = computeProactivityScore(0, 10, 0, 0, 0);
    expect(high).toBeGreaterThanOrEqual(low);
  });
});

// ─── getProactivityTier ───────────────────────────────────────────────────────

describe('getProactivityTier', () => {
  it('returns proactive for score >= 75', () => {
    expect(getProactivityTier(75)).toBe('proactive');
    expect(getProactivityTier(100)).toBe('proactive');
  });

  it('returns engaged for score 50-74', () => {
    expect(getProactivityTier(50)).toBe('engaged');
    expect(getProactivityTier(74)).toBe('engaged');
  });

  it('returns reactive for score 25-49', () => {
    expect(getProactivityTier(25)).toBe('reactive');
    expect(getProactivityTier(49)).toBe('reactive');
  });

  it('returns passive for score < 25', () => {
    expect(getProactivityTier(24)).toBe('passive');
    expect(getProactivityTier(0)).toBe('passive');
  });

  it('boundary: 75 is proactive not engaged', () => {
    expect(getProactivityTier(75)).toBe('proactive');
    expect(getProactivityTier(74)).toBe('engaged');
  });

  it('boundary: 50 is engaged not reactive', () => {
    expect(getProactivityTier(50)).toBe('engaged');
    expect(getProactivityTier(49)).toBe('reactive');
  });

  it('boundary: 25 is reactive not passive', () => {
    expect(getProactivityTier(25)).toBe('reactive');
    expect(getProactivityTier(24)).toBe('passive');
  });
});
