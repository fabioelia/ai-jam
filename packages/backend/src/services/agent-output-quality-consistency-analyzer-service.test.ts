import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeOutputQualityConsistencyScore,
  getOutputQualityRating,
  analyzeAgentOutputQualityConsistency,
} from './agent-output-quality-consistency-analyzer-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('../db/schema.js', () => ({
  agentSessions: { personaType: 'personaType', status: 'status', retryCount: 'retryCount', startedAt: 'startedAt', completedAt: 'completedAt', createdAt: 'createdAt', ticketId: 'ticketId' },
  tickets: { id: 'id', projectId: 'projectId' },
}));

import { db } from '../db/connection.js';

type SessionRow = {
  personaType: string;
  status: string;
  retryCount: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

function makeSession(personaType: string, createdAt: Date, retryCount = 0): SessionRow {
  return { personaType, status: 'completed', retryCount, startedAt: createdAt, completedAt: null, createdAt };
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

describe('computeOutputQualityConsistencyScore', () => {
  it('returns 100 for 0 variance', () => {
    expect(computeOutputQualityConsistencyScore(0)).toBe(100);
  });

  it('returns 0 for variance >= 1600', () => {
    expect(computeOutputQualityConsistencyScore(1600)).toBe(0);
    expect(computeOutputQualityConsistencyScore(2000)).toBe(0);
  });

  it('returns intermediate value for mid variance', () => {
    const score = computeOutputQualityConsistencyScore(800);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });
});

describe('getOutputQualityRating', () => {
  it('returns excellent for score >= 80', () => {
    expect(getOutputQualityRating(80)).toBe('excellent');
    expect(getOutputQualityRating(100)).toBe('excellent');
  });

  it('returns good for score 60-79', () => {
    expect(getOutputQualityRating(60)).toBe('good');
    expect(getOutputQualityRating(79)).toBe('good');
  });

  it('returns fair for score 40-59', () => {
    expect(getOutputQualityRating(40)).toBe('fair');
    expect(getOutputQualityRating(59)).toBe('fair');
  });

  it('returns poor for score < 40', () => {
    expect(getOutputQualityRating(0)).toBe('poor');
    expect(getOutputQualityRating(39)).toBe('poor');
  });
});

describe('analyzeAgentOutputQualityConsistency', () => {
  it('returns empty metrics for empty sessions', async () => {
    mockDb([]);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgConsistencyScore).toBe(0);
    expect(report.inconsistentAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    mockDb([makeSession('AgentA', new Date('2026-04-01'))]);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const rows = [
      makeSession('AgentA', new Date('2026-04-01')),
      makeSession('AgentA', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentName).toBe('AgentA');
  });

  it('report has valid structure', async () => {
    const rows = [
      makeSession('AgentB', new Date('2026-04-01')),
      makeSession('AgentB', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgConsistencyScore');
    expect(report).toHaveProperty('inconsistentAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('consistencyScore in 0-100 range', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeSession('AgentC', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    for (const m of report.metrics) {
      expect(m.consistencyScore).toBeGreaterThanOrEqual(0);
      expect(m.consistencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('rating matches consistencyScore bands', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentD', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    for (const m of report.metrics) {
      expect(m.rating).toBe(getOutputQualityRating(m.consistencyScore));
    }
  });

  it('trend is one of improving | stable | worsening', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentE', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.trend);
    }
  });

  it('metrics sorted ascending by consistencyScore', async () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => makeSession('AlphaAgent', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 3 }, (_, i) => makeSession('BetaAgent', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].consistencyScore).toBeGreaterThanOrEqual(report.metrics[i - 1].consistencyScore);
    }
  });

  it('inconsistentAgents counts agents with consistencyScore < 50', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentF', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    const expected = report.metrics.filter(m => m.consistencyScore < 50).length;
    expect(report.inconsistentAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    mockDb([]);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents produce separate metrics', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => makeSession('Alpha', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Beta', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Gamma', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentOutputQualityConsistency('proj-1');
    expect(report.metrics).toHaveLength(3);
  });
});
