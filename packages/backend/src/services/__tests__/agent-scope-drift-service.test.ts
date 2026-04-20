import { describe, it, expect } from 'vitest';
import {
  computeDriftSeverity,
  computeAdherenceScore,
  computeAdherenceTier,
  buildScopeDriftMetrics,
} from '../agent-scope-drift-service.js';

describe('computeDriftSeverity', () => {
  it('returns minimal for 0 incidents', () => {
    expect(computeDriftSeverity(0, 10)).toBe('minimal');
  });

  it('returns moderate for low ratio', () => {
    // 1 incident out of 10 = 10% = minimal based on actual impl
    // ratio >= 0.1 -> moderate
    expect(computeDriftSeverity(1, 10)).toBe('moderate');
  });

  it('returns critical for high ratio >= 0.5', () => {
    expect(computeDriftSeverity(5, 10)).toBe('critical');
  });

  it('returns significant for ratio >= 0.3', () => {
    expect(computeDriftSeverity(3, 10)).toBe('significant');
  });
});

describe('computeAdherenceScore', () => {
  it('adds bonus for 0 drift incidents', () => {
    const scoreNoDrift = computeAdherenceScore({ scopeAdherenceRate: 80, driftIncidents: 0, avgDriftSeverity: 'minimal' });
    const scoreDrift = computeAdherenceScore({ scopeAdherenceRate: 80, driftIncidents: 2, avgDriftSeverity: 'minimal' });
    expect(scoreNoDrift).toBeGreaterThan(scoreDrift);
  });

  it('penalizes critical drift severity by 20', () => {
    const scoreNormal = computeAdherenceScore({ scopeAdherenceRate: 80, driftIncidents: 1, avgDriftSeverity: 'minimal' });
    const scoreCritical = computeAdherenceScore({ scopeAdherenceRate: 80, driftIncidents: 1, avgDriftSeverity: 'critical' });
    expect(scoreNormal - scoreCritical).toBe(20);
  });

  it('penalizes significant drift severity by 10', () => {
    const scoreNormal = computeAdherenceScore({ scopeAdherenceRate: 80, driftIncidents: 1, avgDriftSeverity: 'minimal' });
    const scoreSig = computeAdherenceScore({ scopeAdherenceRate: 80, driftIncidents: 1, avgDriftSeverity: 'significant' });
    expect(scoreNormal - scoreSig).toBe(10);
  });
});

describe('computeAdherenceTier', () => {
  it('focused at score >= 85', () => {
    expect(computeAdherenceTier(85)).toBe('focused');
    expect(computeAdherenceTier(100)).toBe('focused');
  });

  it('contained at score >= 65', () => {
    expect(computeAdherenceTier(65)).toBe('contained');
    expect(computeAdherenceTier(84)).toBe('contained');
  });

  it('expanding at score >= 45', () => {
    expect(computeAdherenceTier(45)).toBe('expanding');
    expect(computeAdherenceTier(64)).toBe('expanding');
  });

  it('unconstrained at score < 45', () => {
    expect(computeAdherenceTier(0)).toBe('unconstrained');
    expect(computeAdherenceTier(44)).toBe('unconstrained');
  });
});
