import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeCommunicationQualityScore,
  getCommunicationRating,
  analyzeAgentCommunicationQualityAnalyzer,
} from './agent-communication-quality-analyzer-service.js';

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

describe('computeCommunicationQualityScore', () => {
  it('computes weighted combination correctly', () => {
    // 80*0.35 + 70*0.35 + 60*0.30 = 28 + 24.5 + 18 = 70.5 → 71
    expect(computeCommunicationQualityScore(80, 70, 60)).toBe(71);
  });

  it('returns 100 for perfect scores', () => {
    // 100*0.35 + 100*0.35 + 100*0.30 = 35+35+30=100
    expect(computeCommunicationQualityScore(100, 100, 100)).toBe(100);
  });

  it('returns 0 for all-zero scores', () => {
    expect(computeCommunicationQualityScore(0, 0, 0)).toBe(0);
  });

  it('rounds to integer', () => {
    const score = computeCommunicationQualityScore(75, 65, 55);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('getCommunicationRating', () => {
  it('returns excellent for score >= 80', () => {
    expect(getCommunicationRating(80)).toBe('excellent');
    expect(getCommunicationRating(100)).toBe('excellent');
  });

  it('returns good for score 65-79', () => {
    expect(getCommunicationRating(65)).toBe('good');
    expect(getCommunicationRating(79)).toBe('good');
  });

  it('returns fair for score 50-64', () => {
    expect(getCommunicationRating(50)).toBe('fair');
    expect(getCommunicationRating(64)).toBe('fair');
  });

  it('returns poor for score < 50', () => {
    expect(getCommunicationRating(0)).toBe('poor');
    expect(getCommunicationRating(49)).toBe('poor');
  });
});

describe('analyzeAgentCommunicationQualityAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    mockDb([]);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgQualityScore).toBe(0);
    expect(report.poorCommunicators).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    mockDb([makeSession('AgentA', new Date('2026-04-01'))]);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const rows = [
      makeSession('AgentA', new Date('2026-04-01')),
      makeSession('AgentA', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentName).toBe('AgentA');
  });

  it('report has valid structure', async () => {
    mockDb([]);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgQualityScore');
    expect(report).toHaveProperty('poorCommunicators');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('qualityScore is weighted combination of clarity, completeness, actionability', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentB', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    for (const m of report.metrics) {
      const expected = computeCommunicationQualityScore(m.clarityScore, m.completenessScore, m.actionabilityScore);
      expect(m.qualityScore).toBe(expected);
    }
  });

  it('clarityScore in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentC', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.clarityScore).toBeGreaterThanOrEqual(0);
      expect(m.clarityScore).toBeLessThanOrEqual(100);
    }
  });

  it('completenessScore in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentD', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.completenessScore).toBeGreaterThanOrEqual(0);
      expect(m.completenessScore).toBeLessThanOrEqual(100);
    }
  });

  it('actionabilityScore in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentE', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.actionabilityScore).toBeGreaterThanOrEqual(0);
      expect(m.actionabilityScore).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentF', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating matches qualityScore bands', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentG', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.rating).toBe(getCommunicationRating(m.qualityScore));
    }
  });

  it('metrics sorted ascending by qualityScore', async () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => makeSession('AlphaAgent', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 3 }, (_, i) => makeSession('ZetaAgent', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].qualityScore).toBeGreaterThanOrEqual(report.metrics[i - 1].qualityScore);
    }
  });

  it('poorCommunicators counts agents with score < 50', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentH', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    const expected = report.metrics.filter(m => m.qualityScore < 50).length;
    expect(report.poorCommunicators).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    mockDb([]);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents produce separate metrics', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => makeSession('Alpha', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Beta', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Gamma', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentCommunicationQualityAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(3);
  });
});
