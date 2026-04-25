import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeContextRetentionScore,
  getContextRetentionRiskLevel,
  analyzeAgentContextRetentionAnalyzer,
} from './agent-context-retention-analyzer-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('../db/schema.js', () => ({
  agentSessions: { personaType: 'personaType', status: 'status', startedAt: 'startedAt', completedAt: 'completedAt', createdAt: 'createdAt', ticketId: 'ticketId' },
  tickets: { id: 'id', projectId: 'projectId' },
}));

import { db } from '../db/connection.js';

type SessionRow = {
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

function makeSession(personaType: string, createdAt: Date): SessionRow {
  return { personaType, status: 'completed', startedAt: createdAt, completedAt: null, createdAt };
}

function mockDb(rows: SessionRow[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

describe('computeContextRetentionScore', () => {
  it('returns 0 when total is 0', () => {
    expect(computeContextRetentionScore(0, 0)).toBe(0);
  });

  it('returns 100 when all events reused', () => {
    expect(computeContextRetentionScore(10, 10)).toBe(100);
  });

  it('returns 60 for 6 reuse out of 10', () => {
    expect(computeContextRetentionScore(6, 10)).toBe(60);
  });

  it('rounds to integer', () => {
    const score = computeContextRetentionScore(1, 3);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('getContextRetentionRiskLevel', () => {
  it('returns high for score < 50', () => {
    expect(getContextRetentionRiskLevel(0)).toBe('high');
    expect(getContextRetentionRiskLevel(49)).toBe('high');
  });

  it('returns medium for score 50-69', () => {
    expect(getContextRetentionRiskLevel(50)).toBe('medium');
    expect(getContextRetentionRiskLevel(69)).toBe('medium');
  });

  it('returns low for score >= 70', () => {
    expect(getContextRetentionRiskLevel(70)).toBe('low');
    expect(getContextRetentionRiskLevel(100)).toBe('low');
  });
});

describe('analyzeAgentContextRetentionAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    mockDb([]);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgRetentionScore).toBe(0);
    expect(report.poorRetentionAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    mockDb([makeSession('AgentA', new Date('2026-04-01'))]);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const rows = [
      makeSession('AgentA', new Date('2026-04-01')),
      makeSession('AgentA', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentName).toBe('AgentA');
  });

  it('report has valid structure', async () => {
    const rows = [
      makeSession('AgentB', new Date('2026-04-01')),
      makeSession('AgentB', new Date('2026-04-02')),
      makeSession('AgentB', new Date('2026-04-03')),
    ];
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgRetentionScore');
    expect(report).toHaveProperty('poorRetentionAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgRetentionScore is in 0-100 range', async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeSession('AgentC', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    expect(report.fleetAvgRetentionScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgRetentionScore).toBeLessThanOrEqual(100);
  });

  it('retentionScore in 0-100 range for each metric', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeSession('AgentD', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.retentionScore).toBeGreaterThanOrEqual(0);
      expect(m.retentionScore).toBeLessThanOrEqual(100);
    }
  });

  it('metrics sorted ascending by retentionScore', async () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => makeSession('AgentLow', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 3 }, (_, i) => makeSession('AgentHigh', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    if (report.metrics.length >= 2) {
      for (let i = 1; i < report.metrics.length; i++) {
        expect(report.metrics[i].retentionScore).toBeGreaterThanOrEqual(report.metrics[i - 1].retentionScore);
      }
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentE', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('riskLevel matches score bands', async () => {
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeSession('AgentF', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    for (const m of report.metrics) {
      const expected = getContextRetentionRiskLevel(m.retentionScore);
      expect(m.riskLevel).toBe(expected);
    }
  });

  it('poorRetentionAgents counts agents with retentionScore < 60', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentG', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    const expectedPoor = report.metrics.filter(m => m.retentionScore < 60).length;
    expect(report.poorRetentionAgents).toBe(expectedPoor);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    mockDb([]);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents produce separate metrics', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => makeSession('Alpha', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Beta', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Gamma', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentContextRetentionAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(3);
  });
});
