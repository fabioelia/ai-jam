import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSpecializationDriftAnalyzer } from '../agent-specialization-drift-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

const now = Date.now();

function makeSession(agentId: string, i: number, overrides: Record<string, any> = {}) {
  return {
    id: `session-${agentId}-${i}`,
    agentId,
    status: 'completed',
    createdAt: new Date(now - i * 60000),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (db.select as any).mockReturnThis();
  (db.from as any).mockReturnThis();
  (db.orderBy as any).mockReturnThis();
  (db.limit as any).mockResolvedValue([]);
});

describe('analyzeAgentSpecializationDriftAnalyzer', () => {
  it('empty sessions → empty metrics', async () => {
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgDriftScore).toBe(0);
    expect(report.criticalDriftAgents).toBe(0);
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
    expect(typeof report.fleetAvgDriftScore).toBe('number');
    expect(typeof report.criticalDriftAgents).toBe('number');
    expect(typeof report.analysisTimestamp).toBe('string');
  });

  it('analysisTimestamp is ISO string', async () => {
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(report.analysisTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('specializationDriftScore is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    for (const m of report.metrics) {
      expect(m.specializationDriftScore).toBeGreaterThanOrEqual(0);
      expect(m.specializationDriftScore).toBeLessThanOrEqual(1);
    }
  });

  it('primarySpecialty is valid specialty', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(['backend', 'frontend', 'devops', 'qa', 'product']).toContain(report.metrics[0].primarySpecialty);
  });

  it('driftedDomains is an array', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(Array.isArray(report.metrics[0].driftedDomains)).toBe(true);
  });

  it('onSpecialtyTaskRatio is 0-1', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    for (const m of report.metrics) {
      expect(m.onSpecialtyTaskRatio).toBeGreaterThanOrEqual(0);
      expect(m.onSpecialtyTaskRatio).toBeLessThanOrEqual(1);
    }
  });

  it('riskLevel is valid enum', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0)]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(['low', 'medium', 'high', 'critical']).toContain(report.metrics[0].riskLevel);
  });

  it('high error rate → higher drift score', async () => {
    const errorSessions = Array.from({ length: 8 }, (_, i) => makeSession('bad', i, { status: 'error' }));
    const goodSession = makeSession('bad', 8);
    const cleanSessions = Array.from({ length: 10 }, (_, i) => makeSession('good', i));
    (db.limit as any).mockResolvedValueOnce([...errorSessions, goodSession, ...cleanSessions]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    const bad = report.metrics.find(m => m.agentId === 'bad')!;
    const good = report.metrics.find(m => m.agentId === 'good')!;
    expect(bad.specializationDriftScore).toBeGreaterThan(good.specializationDriftScore);
  });

  it('zero errors → low drift score', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession('clean', i));
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(report.metrics[0].specializationDriftScore).toBeLessThan(0.2);
  });

  it('criticalDriftAgents counts high+critical risk agents', async () => {
    (db.limit as any).mockResolvedValueOnce([
      ...Array.from({ length: 9 }, (_, i) => makeSession('bad', i, { status: 'error' })),
      makeSession('bad', 9),
      makeSession('good', 0),
      makeSession('good', 1),
    ]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    const expected = report.metrics.filter(m => m.riskLevel === 'critical' || m.riskLevel === 'high').length;
    expect(report.criticalDriftAgents).toBe(expected);
  });

  it('fleetAvgDriftScore is average of all agents', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('a', 0), makeSession('a', 1),
      makeSession('b', 0), makeSession('b', 1),
    ]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    const expected = Math.round(
      report.metrics.reduce((sum, m) => sum + m.specializationDriftScore, 0) / report.metrics.length * 1000
    ) / 1000;
    expect(report.fleetAvgDriftScore).toBe(expected);
  });

  it('sorted by specializationDriftScore descending', async () => {
    (db.limit as any).mockResolvedValueOnce([
      makeSession('low', 0),
      makeSession('low', 1),
      makeSession('high', 0, { status: 'error' }),
      makeSession('high', 1, { status: 'error' }),
      makeSession('high', 2, { status: 'error' }),
    ]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    const scores = report.metrics.map(m => m.specializationDriftScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });

  it('driftVelocity is a number', async () => {
    (db.limit as any).mockResolvedValueOnce([makeSession('a', 0), makeSession('a', 1)]);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    expect(typeof report.metrics[0].driftVelocity).toBe('number');
  });

  it('riskLevel critical when driftScore >= 0.7', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) =>
      makeSession('bad', i, { status: i < 8 ? 'error' : 'completed' })
    );
    (db.limit as any).mockResolvedValueOnce(sessions);
    const report = await analyzeAgentSpecializationDriftAnalyzer();
    const m = report.metrics[0];
    if (m.specializationDriftScore >= 0.7) {
      expect(m.riskLevel).toBe('critical');
    } else if (m.specializationDriftScore >= 0.4) {
      expect(m.riskLevel).toBe('high');
    }
  });
});
