import { describe, it, expect } from 'vitest';
import {
  computeAdherenceScore,
  computeAdherenceTier,
  computeDriftSeverity,
  buildScopeDriftMetrics,
  generateScopeDriftInsights,
} from './agent-scope-drift-service.js';

describe('agent-scope-drift-service', () => {
  it('computeAdherenceScore applies zero-drift bonus correctly', () => {
    // scopeAdherenceRate=80, driftIncidents=0 → +10 → 90
    const score = computeAdherenceScore({
      scopeAdherenceRate: 80,
      driftIncidents: 0,
      avgDriftSeverity: 'minimal',
    });
    expect(score).toBe(90);
  });

  it('computeAdherenceScore applies critical penalty correctly', () => {
    // scopeAdherenceRate=70, driftIncidents=5, critical → -20 → 50
    const score = computeAdherenceScore({
      scopeAdherenceRate: 70,
      driftIncidents: 5,
      avgDriftSeverity: 'critical',
    });
    expect(score).toBe(50);
  });

  it('computeAdherenceScore applies significant penalty correctly', () => {
    // scopeAdherenceRate=70, driftIncidents=3, significant → -10 → 60
    const score = computeAdherenceScore({
      scopeAdherenceRate: 70,
      driftIncidents: 3,
      avgDriftSeverity: 'significant',
    });
    expect(score).toBe(60);
  });

  it('computeAdherenceScore clamps to 0-100', () => {
    expect(computeAdherenceScore({ scopeAdherenceRate: 0, driftIncidents: 5, avgDriftSeverity: 'critical' })).toBe(0);
    expect(computeAdherenceScore({ scopeAdherenceRate: 100, driftIncidents: 0, avgDriftSeverity: 'minimal' })).toBe(100);
  });

  it('assigns focused tier when score >= 85', () => {
    expect(computeAdherenceTier(85)).toBe('focused');
    expect(computeAdherenceTier(100)).toBe('focused');
  });

  it('assigns unconstrained tier when score < 45', () => {
    expect(computeAdherenceTier(44)).toBe('unconstrained');
    expect(computeAdherenceTier(0)).toBe('unconstrained');
  });

  it('computeDriftSeverity returns minimal for zero drift', () => {
    expect(computeDriftSeverity(0, 10)).toBe('minimal');
  });

  it('buildScopeDriftMetrics returns correct report for empty project', () => {
    const metrics = buildScopeDriftMetrics([], []);
    expect(metrics).toEqual([]);
  });
});
