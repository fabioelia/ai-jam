import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeCollaborationScore,
  getCollaborationRating,
  analyzeAgentCollaborationEfficiencyAnalyzer,
} from './agent-collaboration-efficiency-analyzer-service.js';

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

describe('computeCollaborationScore', () => {
  it('returns weighted combination correctly', () => {
    // 80*0.4 + (100-20)*0.3 + 60*0.3 = 32 + 24 + 18 = 74
    expect(computeCollaborationScore(80, 20, 60)).toBe(74);
  });

  it('returns 100 for perfect rates', () => {
    // 100*0.4 + (100-0)*0.3 + 100*0.3 = 40+30+30=100
    expect(computeCollaborationScore(100, 0, 100)).toBe(100);
  });

  it('returns 0 for zero rates with full overhead', () => {
    // 0*0.4 + (100-100)*0.3 + 0*0.3 = 0
    expect(computeCollaborationScore(0, 100, 0)).toBe(0);
  });

  it('rounds to integer', () => {
    const score = computeCollaborationScore(75, 15, 55);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('getCollaborationRating', () => {
  it('returns excellent for score >= 80', () => {
    expect(getCollaborationRating(80)).toBe('excellent');
    expect(getCollaborationRating(100)).toBe('excellent');
  });

  it('returns good for score 65-79', () => {
    expect(getCollaborationRating(65)).toBe('good');
    expect(getCollaborationRating(79)).toBe('good');
  });

  it('returns fair for score 50-64', () => {
    expect(getCollaborationRating(50)).toBe('fair');
    expect(getCollaborationRating(64)).toBe('fair');
  });

  it('returns poor for score < 50', () => {
    expect(getCollaborationRating(0)).toBe('poor');
    expect(getCollaborationRating(49)).toBe('poor');
  });
});

describe('analyzeAgentCollaborationEfficiencyAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    mockDb([]);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgCollaborationScore).toBe(0);
    expect(report.poorCollaborators).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    mockDb([makeSession('AgentA', new Date('2026-04-01'))]);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const rows = [
      makeSession('AgentA', new Date('2026-04-01')),
      makeSession('AgentA', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentName).toBe('AgentA');
  });

  it('report has valid structure', async () => {
    mockDb([]);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgCollaborationScore');
    expect(report).toHaveProperty('poorCollaborators');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('collaborationScore in 0-100 range', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeSession('AgentB', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.collaborationScore).toBeGreaterThanOrEqual(0);
      expect(m.collaborationScore).toBeLessThanOrEqual(100);
    }
  });

  it('handoffSuccessRate in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentC', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.handoffSuccessRate).toBeGreaterThanOrEqual(0);
      expect(m.handoffSuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('coordinationOverhead in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentD', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.coordinationOverhead).toBeGreaterThanOrEqual(0);
      expect(m.coordinationOverhead).toBeLessThanOrEqual(100);
    }
  });

  it('sharedContextReuseRate in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentE', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.sharedContextReuseRate).toBeGreaterThanOrEqual(0);
      expect(m.sharedContextReuseRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentF', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating matches collaborationScore bands', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentG', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.rating).toBe(getCollaborationRating(m.collaborationScore));
    }
  });

  it('metrics sorted ascending by collaborationScore', async () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => makeSession('AlphaAgent', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 3 }, (_, i) => makeSession('ZetaAgent', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].collaborationScore).toBeGreaterThanOrEqual(report.metrics[i - 1].collaborationScore);
    }
  });

  it('poorCollaborators counts agents with score < 50', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentH', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    const expected = report.metrics.filter(m => m.collaborationScore < 50).length;
    expect(report.poorCollaborators).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    mockDb([]);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents produce separate metrics', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => makeSession('Alpha', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Beta', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Gamma', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentCollaborationEfficiencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(3);
  });
});
