import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeGoalDriftScore,
  getGoalDriftSeverity,
  analyzeAgentGoalDrift,
} from './agent-goal-drift-analyzer-service.js';

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

describe('computeGoalDriftScore', () => {
  it('returns 0 when total is 0', () => {
    expect(computeGoalDriftScore(0, 0)).toBe(0);
  });

  it('returns 100 for full drift', () => {
    expect(computeGoalDriftScore(10, 10)).toBe(100);
  });

  it('caps at 100', () => {
    expect(computeGoalDriftScore(100, 10)).toBe(100);
  });

  it('returns proportional score', () => {
    const score = computeGoalDriftScore(1, 10);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('getGoalDriftSeverity', () => {
  it('returns critical for score >= 75', () => {
    expect(getGoalDriftSeverity(75)).toBe('critical');
    expect(getGoalDriftSeverity(100)).toBe('critical');
  });

  it('returns high for score 50-74', () => {
    expect(getGoalDriftSeverity(50)).toBe('high');
    expect(getGoalDriftSeverity(74)).toBe('high');
  });

  it('returns medium for score 25-49', () => {
    expect(getGoalDriftSeverity(25)).toBe('medium');
    expect(getGoalDriftSeverity(49)).toBe('medium');
  });

  it('returns low for score < 25', () => {
    expect(getGoalDriftSeverity(0)).toBe('low');
    expect(getGoalDriftSeverity(24)).toBe('low');
  });
});

describe('analyzeAgentGoalDrift', () => {
  it('returns empty metrics for empty sessions', async () => {
    mockDb([]);
    const report = await analyzeAgentGoalDrift('proj-1');
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgDriftScore).toBe(0);
    expect(report.highDriftAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    mockDb([makeSession('AgentA', new Date('2026-04-01'))]);
    const report = await analyzeAgentGoalDrift('proj-1');
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const rows = [
      makeSession('AgentA', new Date('2026-04-01')),
      makeSession('AgentA', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentName).toBe('AgentA');
  });

  it('report has valid structure', async () => {
    const rows = [
      makeSession('AgentB', new Date('2026-04-01')),
      makeSession('AgentB', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgDriftScore');
    expect(report).toHaveProperty('highDriftAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('driftScore in 0-100 range', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeSession('AgentC', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    for (const m of report.metrics) {
      expect(m.driftScore).toBeGreaterThanOrEqual(0);
      expect(m.driftScore).toBeLessThanOrEqual(100);
    }
  });

  it('severity matches driftScore bands', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentD', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    for (const m of report.metrics) {
      expect(m.severity).toBe(getGoalDriftSeverity(m.driftScore));
    }
  });

  it('trend is one of improving | stable | worsening', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentE', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.trend);
    }
  });

  it('metrics sorted descending by driftScore', async () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => makeSession('AlphaAgent', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 3 }, (_, i) => makeSession('BetaAgent', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].driftScore).toBeLessThanOrEqual(report.metrics[i - 1].driftScore);
    }
  });

  it('highDriftAgents counts agents with driftScore > 60', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentF', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    const expected = report.metrics.filter(m => m.driftScore > 60).length;
    expect(report.highDriftAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    mockDb([]);
    const report = await analyzeAgentGoalDrift('proj-1');
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents produce separate metrics', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => makeSession('Alpha', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Beta', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Gamma', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentGoalDrift('proj-1');
    expect(report.metrics).toHaveLength(3);
  });
});
