import { describe, it, expect } from 'vitest';
import {
  computeViolationSeverity,
  computeComplianceScore,
  computeComplianceTier,
  buildComplianceMetrics,
} from './agent-instruction-compliance-service.js';

describe('agent-instruction-compliance-service', () => {
  it('empty sessions returns empty agents', () => {
    const result = buildComplianceMetrics([]);
    expect(result).toHaveLength(0);
  });

  it('computeComplianceScore: zero violations → +10 bonus', () => {
    const score = computeComplianceScore(80, 0, 'minor');
    expect(score).toBe(90);
  });

  it('computeComplianceScore: critical severity → -20 penalty', () => {
    const score = computeComplianceScore(80, 1, 'critical');
    expect(score).toBe(60);
  });

  it('computeComplianceScore: major severity → -10 penalty', () => {
    const score = computeComplianceScore(80, 1, 'major');
    expect(score).toBe(70);
  });

  it('complianceTier thresholds: exemplary(90), compliant(70), partial(45), defiant(<45)', () => {
    expect(computeComplianceTier(95)).toBe('exemplary');
    expect(computeComplianceTier(75)).toBe('compliant');
    expect(computeComplianceTier(50)).toBe('partial');
    expect(computeComplianceTier(30)).toBe('defiant');
  });

  it('mostCompliant is agent with highest complianceScore', () => {
    const sessions = [
      { id: 's1', ticketId: 't1', personaType: 'alice', status: 'completed' },
      { id: 's2', ticketId: 't2', personaType: 'alice', status: 'completed' },
      { id: 's3', ticketId: 't3', personaType: 'bob', status: 'failed' },
      { id: 's4', ticketId: 't4', personaType: 'bob', status: 'failed' },
    ];
    const agents = buildComplianceMetrics(sessions);
    expect(agents[0].agentId).toBe('alice');
  });

  it('exemplaryAgents count is correct', () => {
    const sessions = [
      { id: 's1', ticketId: 't1', personaType: 'alice', status: 'completed' },
      { id: 's2', ticketId: 't2', personaType: 'alice', status: 'completed' },
    ];
    const agents = buildComplianceMetrics(sessions);
    const exemplary = agents.filter((a) => a.complianceTier === 'exemplary');
    expect(exemplary.length).toBeGreaterThanOrEqual(1);
  });

  it('avgComplianceScore computed across agents', () => {
    const sessions = [
      { id: 's1', ticketId: 't1', personaType: 'alice', status: 'completed' },
      { id: 's2', ticketId: 't2', personaType: 'bob', status: 'failed' },
    ];
    const agents = buildComplianceMetrics(sessions);
    const avg = Math.round(agents.reduce((s, a) => s + a.complianceScore, 0) / agents.length);
    expect(avg).toBeGreaterThanOrEqual(0);
    expect(avg).toBeLessThanOrEqual(100);
  });

  it('violationCount uses failed sessions', () => {
    const sessions = [
      { id: 's1', ticketId: 't1', personaType: 'alice', status: 'completed' },
      { id: 's2', ticketId: 't2', personaType: 'alice', status: 'failed' },
      { id: 's3', ticketId: 't3', personaType: 'alice', status: 'failed' },
    ];
    const agents = buildComplianceMetrics(sessions);
    expect(agents[0].violationCount).toBe(2);
  });
});
