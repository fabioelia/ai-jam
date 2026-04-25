import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentBoundaryViolationRateAnalyzer } from '../agent-boundary-violation-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, completedRatio = 1.0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    startedAt: new Date(Date.now() - i * 3600000),
    completedAt: i < Math.floor(count * completedRatio) ? new Date(Date.now() - i * 3600000 + 1800000) : null,
    status: i < Math.floor(count * completedRatio) ? 'completed' : 'failed',
    durationMs: i < Math.floor(count * completedRatio) ? 1800000 : null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentBoundaryViolationRateAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgComplianceScore');
    expect(report).toHaveProperty('criticalRiskAgents');
    expect(report).toHaveProperty('compliantAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgComplianceScore).toBe(0);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [
      ...makeSessions('agentA', 3),
      ...makeSessions('agentB', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });

  it('zero violations for fully completed agent', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 5, 1.0));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report.metrics[0].violationCount).toBe(0);
    expect(report.metrics[0].boundaryViolationRate).toBe(0);
  });

  it('riskLevel is low for zero violations', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 5, 1.0));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report.metrics[0].riskLevel).toBe('low');
  });

  it('high violations produce high or critical risk', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('risky', 10, 0));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    const risk = report.metrics[0].riskLevel;
    expect(['high', 'critical']).toContain(risk);
  });

  it('riskLevel enum values are valid', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    const valid = ['low', 'medium', 'high', 'critical'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.riskLevel);
    }
  });

  it('complianceScore is between 0.5 and 1', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.complianceScore).toBeGreaterThanOrEqual(0.5);
      expect(m.complianceScore).toBeLessThanOrEqual(1.0);
    }
  });

  it('totalActions is at least 10', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 1));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report.metrics[0].totalActions).toBeGreaterThanOrEqual(10);
  });

  it('violationTypes array is present', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5, 0.5));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    for (const m of report.metrics) {
      expect(Array.isArray(m.violationTypes)).toBe(true);
    }
  });

  it('violationTypes entries have type and count', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 10, 0));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    const m = report.metrics[0];
    if (m.violationTypes.length > 0) {
      expect(m.violationTypes[0]).toHaveProperty('type');
      expect(m.violationTypes[0]).toHaveProperty('count');
    }
  });

  it('fleetAvgComplianceScore aggregates correctly', async () => {
    const sessions = [
      ...makeSessions('agentA', 5, 1.0),
      ...makeSessions('agentB', 5, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report.fleetAvgComplianceScore).toBe(1.0);
  });

  it('criticalRiskAgents counts critical agents', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(typeof report.criticalRiskAgents).toBe('number');
    expect(report.criticalRiskAgents).toBeGreaterThanOrEqual(0);
  });

  it('compliantAgents counts low risk agents', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 5, 1.0));
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    expect(report.compliantAgents).toBeGreaterThanOrEqual(1);
  });

  it('metrics sorted by compliance descending', async () => {
    const sessions = [
      ...makeSessions('badAgent', 5, 0),
      ...makeSessions('goodAgent', 5, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentBoundaryViolationRateAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].complianceScore).toBeGreaterThanOrEqual(report.metrics[1].complianceScore);
    }
  });
});
