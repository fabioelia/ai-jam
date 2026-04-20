import { describe, it, expect } from 'vitest';
import {
  computeAdaptationScore,
  computeAdaptationTier,
  buildAdaptationMetrics,
  generateAdaptationInsights,
} from './agent-adaptation-speed-service.js';

describe('agent-adaptation-speed-service', () => {
  it('computeAdaptationScore applies correct formula', () => {
    // feedbackIncorporationRate=100, avgIterationsToSuccess=1, requirementChangeCount=0
    // score = 100*0.5 + max(0, 20-1*4) + 0 = 50 + 16 = 66
    const score = computeAdaptationScore({
      feedbackIncorporationRate: 100,
      avgIterationsToSuccess: 1,
      requirementChangeCount: 0,
    });
    expect(score).toBe(66);
  });

  it('computeAdaptationScore adds 10 bonus for requirementChangeCount >= 5', () => {
    // feedbackRate=0, iterations=5 (bonus=0), requirementChanges=5 (+10)
    const score = computeAdaptationScore({
      feedbackIncorporationRate: 0,
      avgIterationsToSuccess: 5,
      requirementChangeCount: 5,
    });
    expect(score).toBe(10);
  });

  it('computeAdaptationScore adds 5 bonus for requirementChangeCount >= 2', () => {
    const score = computeAdaptationScore({
      feedbackIncorporationRate: 0,
      avgIterationsToSuccess: 5,
      requirementChangeCount: 3,
    });
    expect(score).toBe(5);
  });

  it('assigns rapid tier when score >= 75', () => {
    expect(computeAdaptationTier(75)).toBe('rapid');
    expect(computeAdaptationTier(100)).toBe('rapid');
  });

  it('assigns responsive tier when score >= 55 and < 75', () => {
    expect(computeAdaptationTier(55)).toBe('responsive');
    expect(computeAdaptationTier(74)).toBe('responsive');
  });

  it('assigns gradual tier when score >= 35 and < 55', () => {
    expect(computeAdaptationTier(35)).toBe('gradual');
    expect(computeAdaptationTier(54)).toBe('gradual');
  });

  it('assigns resistant tier when score < 35', () => {
    expect(computeAdaptationTier(34)).toBe('resistant');
    expect(computeAdaptationTier(0)).toBe('resistant');
  });

  it('buildAdaptationMetrics returns correct summary fields', () => {
    const sessions = [
      { id: 's1', ticketId: 't1', personaType: 'dev', status: 'completed', startedAt: new Date('2026-01-01') },
      { id: 's2', ticketId: 't1', personaType: 'dev', status: 'failed', startedAt: new Date('2026-01-02') },
      { id: 's3', ticketId: 't1', personaType: 'dev', status: 'completed', startedAt: new Date('2026-01-03') },
    ];
    const metrics = buildAdaptationMetrics(sessions, [], [{ id: 't1', assignedPersona: 'dev', status: 'done' }]);
    expect(metrics.length).toBe(1);
    const dev = metrics[0];
    expect(dev.agentId).toBe('dev');
    expect(dev.adaptationScore).toBeGreaterThanOrEqual(0);
    expect(dev.adaptationScore).toBeLessThanOrEqual(100);
    expect(['rapid', 'responsive', 'gradual', 'resistant']).toContain(dev.adaptationTier);
  });
});
