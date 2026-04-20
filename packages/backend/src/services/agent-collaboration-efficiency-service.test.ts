import { describe, it, expect } from 'vitest';
import {
  computeCollaborationScore,
  computeCollaborationTier,
  buildCollaborationMetrics,
  computeNetworkDensity,
  generateInsights,
  generateRecommendations,
} from './agent-collaboration-efficiency-service.js';

describe('agent-collaboration-efficiency-service', () => {
  it('returns correct report shape from buildCollaborationMetrics', () => {
    const sessions = [
      { id: 's1', personaType: 'dev', status: 'completed', outputSummary: 'done' },
    ];
    const notes = [{ handoffFrom: 'dev', handoffTo: 'qa' }];
    const metrics = buildCollaborationMetrics(sessions, notes);
    expect(Array.isArray(metrics)).toBe(true);
    const dev = metrics.find((m) => m.agentId === 'dev');
    expect(dev).toBeDefined();
    expect(dev!.collaborationScore).toBeGreaterThanOrEqual(0);
    expect(dev!.collaborationScore).toBeLessThanOrEqual(100);
    expect(dev!.collaborationTier).toBeDefined();
  });

  it('computeCollaborationScore applies correct formula', () => {
    // continuationRate=100, contextUtilizationRate=100, handoffs=20
    const score = computeCollaborationScore(100, 100, 10, 10);
    // 100*0.4 + 100*0.4 + (20/20*100)*0.2 = 40+40+20 = 100
    expect(score).toBe(100);
  });

  it('computeCollaborationScore clamps to 0-100', () => {
    expect(computeCollaborationScore(0, 0, 0, 0)).toBe(0);
    expect(computeCollaborationScore(100, 100, 50, 50)).toBe(100);
  });

  it('assigns synergistic tier when score >= 80', () => {
    expect(computeCollaborationTier(80)).toBe('synergistic');
    expect(computeCollaborationTier(100)).toBe('synergistic');
  });

  it('assigns cooperative tier when score >= 60 and < 80', () => {
    expect(computeCollaborationTier(60)).toBe('cooperative');
    expect(computeCollaborationTier(79)).toBe('cooperative');
  });

  it('assigns independent tier when score >= 40 and < 60', () => {
    expect(computeCollaborationTier(40)).toBe('independent');
    expect(computeCollaborationTier(59)).toBe('independent');
  });

  it('assigns isolated tier when score < 40', () => {
    expect(computeCollaborationTier(39)).toBe('isolated');
    expect(computeCollaborationTier(0)).toBe('isolated');
  });

  it('computeNetworkDensity returns 0 for single agent', () => {
    const notes = [{ handoffFrom: 'dev', handoffTo: null }];
    expect(computeNetworkDensity(1, notes)).toBe(0);
  });
});
