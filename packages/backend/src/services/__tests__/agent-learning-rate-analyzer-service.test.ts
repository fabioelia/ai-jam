import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentLearningRate } from '../agent-learning-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

const mockDb = await import('../../db/connection.js');

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(Date.now() - i * 3600000 + 1800000),
    startedAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  (mockDb.db.select as any).mockReturnThis();
  (mockDb.db.from as any).mockReturnThis();
  (mockDb.db.orderBy as any).mockReturnThis();
});

describe('analyzeAgentLearningRate', () => {
  it('returns valid report shape with empty sessions', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentLearningRate();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgLearningScore');
    expect(report).toHaveProperty('stagnantAgents');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with only 1 session', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-solo', 1));
    const report = await analyzeAgentLearningRate();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agent with 2+ sessions', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 3));
    const report = await analyzeAgentLearningRate();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentId).toBe('agent-a');
  });

  it('fleetAvgLearningScore is 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-b', 4));
    const report = await analyzeAgentLearningRate();
    expect(report.fleetAvgLearningScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgLearningScore).toBeLessThanOrEqual(100);
  });

  it('stagnantAgents counts learningScore < 40', async () => {
    const sessions = [
      ...makeSessions('agent-c', 5),
      ...makeSessions('agent-d', 5),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentLearningRate();
    const expectedStagnant = report.metrics.filter(m => m.learningScore < 40).length;
    expect(report.stagnantAgents).toBe(expectedStagnant);
  });

  it('learningScore is 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue([...makeSessions('agent-e', 6), ...makeSessions('agent-f', 4)]);
    const report = await analyzeAgentLearningRate();
    for (const m of report.metrics) {
      expect(m.learningScore).toBeGreaterThanOrEqual(0);
      expect(m.learningScore).toBeLessThanOrEqual(100);
    }
  });

  it('repeatErrorRate is 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentLearningRate();
    for (const m of report.metrics) {
      expect(m.repeatErrorRate).toBeGreaterThanOrEqual(0);
      expect(m.repeatErrorRate).toBeLessThanOrEqual(100);
    }
  });

  it('trend is valid value', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 4));
    const report = await analyzeAgentLearningRate();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('learningLevel correct for score bands', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 5));
    const report = await analyzeAgentLearningRate();
    for (const m of report.metrics) {
      const expected =
        m.learningScore >= 75 ? 'rapid' :
        m.learningScore >= 55 ? 'steady' :
        m.learningScore >= 35 ? 'slow' : 'stagnant';
      expect(m.learningLevel).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentLearningRate();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by learningScore', async () => {
    const sessions = [
      ...makeSessions('agent-j', 5),
      ...makeSessions('agent-k', 4),
      ...makeSessions('agent-l', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentLearningRate();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].learningScore).toBeGreaterThanOrEqual(report.metrics[i - 1].learningScore);
    }
  });

  it('totalSessionsAnalyzed matches session count', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-m', 7));
    const report = await analyzeAgentLearningRate();
    expect(report.metrics[0].totalSessionsAnalyzed).toBe(7);
  });

  it('improvementRate is a number (can be negative)', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-n', 3));
    const report = await analyzeAgentLearningRate();
    for (const m of report.metrics) {
      expect(typeof m.improvementRate).toBe('number');
    }
  });

  it('sessionSuccessProgression is a number', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-o', 3));
    const report = await analyzeAgentLearningRate();
    for (const m of report.metrics) {
      expect(typeof m.sessionSuccessProgression).toBe('number');
    }
  });
});
