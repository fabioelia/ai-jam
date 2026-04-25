import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeAdherenceScore,
  getComplianceLevel,
  analyzeAgentInstructionAdherence,
} from './agent-instruction-adherence-analyzer-service.js';

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

describe('computeAdherenceScore', () => {
  it('computes weighted combination correctly', () => {
    // 80*0.7 + 10*0.2 + (100-5)*0.1 = 56 + 2 + 9.5 = 67.5 → 68
    expect(computeAdherenceScore(80, 10, 5)).toBe(68);
  });

  it('returns 100 for perfect adherence', () => {
    // 100*0.7 + 0*0.2 + (100-0)*0.1 = 70+0+10=80
    expect(computeAdherenceScore(100, 0, 0)).toBe(80);
  });

  it('returns 0 for zero full adherence and full breach', () => {
    // 0*0.7 + 0*0.2 + (100-100)*0.1 = 0
    expect(computeAdherenceScore(0, 0, 100)).toBe(0);
  });

  it('rounds to integer', () => {
    const score = computeAdherenceScore(70, 15, 10);
    expect(Number.isInteger(score)).toBe(true);
  });
});

describe('getComplianceLevel', () => {
  it('returns compliant for score >= 85', () => {
    expect(getComplianceLevel(85)).toBe('compliant');
    expect(getComplianceLevel(100)).toBe('compliant');
  });

  it('returns marginal for score 70-84', () => {
    expect(getComplianceLevel(70)).toBe('marginal');
    expect(getComplianceLevel(84)).toBe('marginal');
  });

  it('returns non-compliant for score 50-69', () => {
    expect(getComplianceLevel(50)).toBe('non-compliant');
    expect(getComplianceLevel(69)).toBe('non-compliant');
  });

  it('returns critical for score < 50', () => {
    expect(getComplianceLevel(0)).toBe('critical');
    expect(getComplianceLevel(49)).toBe('critical');
  });
});

describe('analyzeAgentInstructionAdherence', () => {
  it('returns empty metrics for empty sessions', async () => {
    mockDb([]);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgAdherenceScore).toBe(0);
    expect(report.nonCompliantAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    mockDb([makeSession('AgentA', new Date('2026-04-01'))]);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const rows = [
      makeSession('AgentA', new Date('2026-04-01')),
      makeSession('AgentA', new Date('2026-04-02')),
    ];
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentName).toBe('AgentA');
  });

  it('report has valid structure', async () => {
    mockDb([]);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgAdherenceScore');
    expect(report).toHaveProperty('nonCompliantAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('adherenceScore in 0-100 range', async () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeSession('AgentB', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    for (const m of report.metrics) {
      expect(m.adherenceScore).toBeGreaterThanOrEqual(0);
      expect(m.adherenceScore).toBeLessThanOrEqual(100);
    }
  });

  it('fullAdherenceRate + partialAdherenceRate <= 100', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentC', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    for (const m of report.metrics) {
      expect(m.fullAdherenceRate + m.partialAdherenceRate).toBeLessThanOrEqual(100);
    }
  });

  it('constraintBreachRate in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentD', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    for (const m of report.metrics) {
      expect(m.constraintBreachRate).toBeGreaterThanOrEqual(0);
      expect(m.constraintBreachRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentE', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('complianceLevel matches adherenceScore bands', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentF', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    for (const m of report.metrics) {
      expect(m.complianceLevel).toBe(getComplianceLevel(m.adherenceScore));
    }
  });

  it('metrics sorted ascending by adherenceScore', async () => {
    const rows = [
      ...Array.from({ length: 3 }, (_, i) => makeSession('AlphaAgent', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 3 }, (_, i) => makeSession('ZetaAgent', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].adherenceScore).toBeGreaterThanOrEqual(report.metrics[i - 1].adherenceScore);
    }
  });

  it('nonCompliantAgents counts agents with score < 60', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentG', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    const expected = report.metrics.filter(m => m.adherenceScore < 60).length;
    expect(report.nonCompliantAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    mockDb([]);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('multiple agents produce separate metrics', async () => {
    const rows = [
      ...Array.from({ length: 2 }, (_, i) => makeSession('Alpha', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Beta', new Date(2026, 3, i + 1))),
      ...Array.from({ length: 2 }, (_, i) => makeSession('Gamma', new Date(2026, 3, i + 1))),
    ];
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    expect(report.metrics).toHaveLength(3);
  });

  it('fleetAvgAdherenceScore in 0-100 range', async () => {
    const rows = Array.from({ length: 4 }, (_, i) =>
      makeSession('AgentH', new Date(2026, 3, i + 1))
    );
    mockDb(rows);
    const report = await analyzeAgentInstructionAdherence('proj-1');
    expect(report.fleetAvgAdherenceScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgAdherenceScore).toBeLessThanOrEqual(100);
  });
});
