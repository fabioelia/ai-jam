import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentWorkflowCoverage } from '../agent-workflow-coverage-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `sess-${agentId}-${i}`,
    agentId,
    createdAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentWorkflowCoverage', () => {
  it('returns valid report shape with empty sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentWorkflowCoverage();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgCoverageScore');
    expect(report).toHaveProperty('lowCoverageAgents');
    expect(report).toHaveProperty('fullCoverageAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgCoverageScore is 0 for empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentWorkflowCoverage();
    expect(report.fleetAvgCoverageScore).toBe(0);
  });

  it('excludes agents with only 1 session', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 1));
    const report = await analyzeAgentWorkflowCoverage();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 3),
      ...makeSessions('agent-b', 4),
    ]);
    const report = await analyzeAgentWorkflowCoverage();
    expect(report.metrics.length).toBeGreaterThanOrEqual(2);
  });

  it('fleetAvgCoverageScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentWorkflowCoverage();
    expect(report.fleetAvgCoverageScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgCoverageScore).toBeLessThanOrEqual(100);
  });

  it('coverageScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentWorkflowCoverage();
    for (const m of report.metrics) {
      expect(m.coverageScore).toBeGreaterThanOrEqual(0);
      expect(m.coverageScore).toBeLessThanOrEqual(100);
    }
  });

  it('autonomousSteps + assistedSteps + blockedSteps === totalWorkflowSteps', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentWorkflowCoverage();
    for (const m of report.metrics) {
      expect(m.autonomousSteps + m.assistedSteps + m.blockedSteps).toBe(m.totalWorkflowSteps);
    }
  });

  it('coverageTrend is one of expanding | stable | shrinking', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentWorkflowCoverage();
    const valid = ['expanding', 'stable', 'shrinking'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.coverageTrend);
    }
  });

  it('coverageLevel correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentWorkflowCoverage();
    for (const m of report.metrics) {
      if (m.coverageScore >= 90) expect(m.coverageLevel).toBe('full');
      else if (m.coverageScore >= 70) expect(m.coverageLevel).toBe('high');
      else if (m.coverageScore >= 50) expect(m.coverageLevel).toBe('partial');
      else expect(m.coverageLevel).toBe('low');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentWorkflowCoverage();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by coverageScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
      ...makeSessions('agent-c', 5),
    ]);
    const report = await analyzeAgentWorkflowCoverage();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].coverageScore).toBeGreaterThanOrEqual(report.metrics[i - 1].coverageScore);
    }
  });

  it('lowCoverageAgents counts agents with score < 50', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentWorkflowCoverage();
    const expected = report.metrics.filter(m => m.coverageScore < 50).length;
    expect(report.lowCoverageAgents).toBe(expected);
  });

  it('fullCoverageAgents counts agents with score >= 90', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('agent-a', 5),
      ...makeSessions('agent-b', 5),
    ]);
    const report = await analyzeAgentWorkflowCoverage();
    const expected = report.metrics.filter(m => m.coverageScore >= 90).length;
    expect(report.fullCoverageAgents).toBe(expected);
  });

  it('empty sessions → empty metrics array', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentWorkflowCoverage();
    expect(report.metrics).toEqual([]);
  });
});
