import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCollaborationBottleneckAnalyzer } from '../agent-collaboration-bottleneck-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date) {
  return {
    id: Math.random().toString(),
    agentId,
    status: 'completed',
    createdAt: createdAt.toISOString(),
    startedAt: createdAt.toISOString(),
    completedAt: new Date(createdAt.getTime() + 30000).toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentCollaborationBottleneckAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgCollaborationScore as number', async () => {
    setupMock([]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(typeof report.fleetAvgCollaborationScore).toBe('number');
  });

  it('returns bottleneckAgents count', async () => {
    setupMock([]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(typeof report.bottleneckAgents).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(report.metrics).toHaveLength(1);
  });

  it('fleetAvgCollaborationScore in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 6 }, (_, i) =>
      makeSession(`agent-${String.fromCharCode(65 + Math.floor(i / 2))}`, new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    expect(report.fleetAvgCollaborationScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgCollaborationScore).toBeLessThanOrEqual(100);
  });

  it('metrics sorted ascending by collaborationScore', async () => {
    const now = new Date();
    const sessions = ['X', 'Y', 'Z'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].collaborationScore).toBeGreaterThanOrEqual(report.metrics[i - 1].collaborationScore);
    }
  });

  it('collaborationTrend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.collaborationTrend);
    }
  });

  it('rating correct for score bands', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
      if (m.collaborationScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.collaborationScore >= 65) expect(m.rating).toBe('good');
      else if (m.collaborationScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('handoffSuccessRate in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(m.handoffSuccessRate).toBeGreaterThanOrEqual(0);
      expect(m.handoffSuccessRate).toBeLessThanOrEqual(100);
    }
  });

  it('contextAbsorptionRate in 0-100 range', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(m.contextAbsorptionRate).toBeGreaterThanOrEqual(0);
      expect(m.contextAbsorptionRate).toBeLessThanOrEqual(100);
    }
  });

  it('bottleneckAgents counts agents with bottleneckFrequency > 30', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentCollaborationBottleneckAnalyzer();
    const expected = report.metrics.filter(m => m.bottleneckFrequency > 30).length;
    expect(report.bottleneckAgents).toBe(expected);
  });
});
