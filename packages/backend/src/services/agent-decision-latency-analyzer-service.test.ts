import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeDecisionLatencyRating,
  analyzeAgentDecisionLatencyAnalyzer,
} from './agent-decision-latency-analyzer-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('../db/schema.js', () => ({
  agentSessions: { personaType: 'personaType', startedAt: 'startedAt', completedAt: 'completedAt', createdAt: 'createdAt', ticketId: 'ticketId' },
  tickets: { id: 'id', projectId: 'projectId' },
}));

import { db } from '../db/connection.js';

type SessionRow = {
  personaType: string;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

function makeSession(personaType: string, createdAt: Date, startedAt?: Date): SessionRow {
  return { personaType, startedAt: startedAt ?? null, completedAt: null, createdAt };
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

describe('computeDecisionLatencyRating', () => {
  it('returns fast for avgMs < 500', () => {
    expect(computeDecisionLatencyRating(0)).toBe('fast');
    expect(computeDecisionLatencyRating(499)).toBe('fast');
  });

  it('returns acceptable for 500-1999ms', () => {
    expect(computeDecisionLatencyRating(500)).toBe('acceptable');
    expect(computeDecisionLatencyRating(1999)).toBe('acceptable');
  });

  it('returns slow for 2000-4999ms', () => {
    expect(computeDecisionLatencyRating(2000)).toBe('slow');
    expect(computeDecisionLatencyRating(4999)).toBe('slow');
  });

  it('returns critical for >= 5000ms', () => {
    expect(computeDecisionLatencyRating(5000)).toBe('critical');
    expect(computeDecisionLatencyRating(99999)).toBe('critical');
  });
});

describe('analyzeAgentDecisionLatencyAnalyzer', () => {
  it('returns empty metrics for empty sessions', async () => {
    mockDb([]);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgLatencyMs).toBe(0);
    expect(report.slowAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    mockDb([makeSession('AgentA', new Date('2026-04-01'))]);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const rows = [
      makeSession('AgentA', new Date('2026-04-01')),
      makeSession('AgentA', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentName).toBe('AgentA');
  });

  it('report has valid structure', async () => {
    const rows = [
      makeSession('AgentB', new Date('2026-04-01')),
      makeSession('AgentB', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgLatencyMs');
    expect(report).toHaveProperty('slowAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('avgDecisionLatencyMs is non-negative', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentC', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.avgDecisionLatencyMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('rating matches latency bands', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentD', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.rating).toBe(computeDecisionLatencyRating(m.avgDecisionLatencyMs));
    }
  });

  it('trend is one of improving | stable | worsening', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentE', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.trend);
    }
  });

  it('p95LatencyMs >= p50LatencyMs', async () => {
    const base = new Date('2026-04-01');
    const rows = Array.from({ length: 6 }, (_, i) => {
      const createdAt = new Date(base.getTime() + i * 1000);
      const startedAt = new Date(createdAt.getTime() + (i + 1) * 500);
      return makeSession('AgentF', createdAt, startedAt);
    });
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    for (const m of report.metrics) {
      expect(m.p95LatencyMs).toBeGreaterThanOrEqual(m.p50LatencyMs);
    }
  });

  it('slowAgents counts agents with avgDecisionLatencyMs > 5000', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentG', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    const expected = report.metrics.filter(m => m.avgDecisionLatencyMs > 5000).length;
    expect(report.slowAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    mockDb([]);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents produce separate metrics', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => makeSession('Alpha', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Beta', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Gamma', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentDecisionLatencyAnalyzer('proj-1');
    expect(report.metrics).toHaveLength(3);
  });
});
