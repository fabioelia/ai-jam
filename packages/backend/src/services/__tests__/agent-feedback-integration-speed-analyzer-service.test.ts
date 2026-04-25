import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { analyzeAgentFeedbackIntegrationSpeedAnalyzer } from '../agent-feedback-integration-speed-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { id: 's1', agentId: 'agent-1', status: 'completed', startedAt: new Date(Date.now() - 10000), completedAt: new Date(Date.now() - 5000), createdAt: new Date(), agentName: 'Alice' },
      { id: 's2', agentId: 'agent-1', status: 'completed', startedAt: new Date(Date.now() - 20000), completedAt: new Date(Date.now() - 15000), createdAt: new Date(), agentName: 'Alice' },
      { id: 's3', agentId: 'agent-1', status: 'error', startedAt: new Date(Date.now() - 30000), completedAt: new Date(Date.now() - 25000), createdAt: new Date(), agentName: 'Alice' },
      { id: 's4', agentId: 'agent-2', status: 'completed', startedAt: new Date(Date.now() - 10000), completedAt: new Date(Date.now() - 2000), createdAt: new Date(), agentName: 'Bob' },
      { id: 's5', agentId: 'agent-2', status: 'error', startedAt: new Date(Date.now() - 20000), completedAt: new Date(Date.now() - 12000), createdAt: new Date(), agentName: 'Bob' },
    ]),
  },
}));

import { db } from '../../db/connection.js';

const now = Date.now();

function makeSessions(agentId: string, count: number, status: string = 'completed') {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status,
    startedAt: new Date(now - (i + 1) * 10000),
    completedAt: new Date(now - i * 10000),
    createdAt: new Date(now - i * 3600000),
  }));
}

function makeSessionsMixed(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: i % 3 === 0 ? 'error' : 'completed',
    startedAt: new Date(now - (i + 1) * 10000),
    completedAt: new Date(now - i * 10000),
    createdAt: new Date(now - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentFeedbackIntegrationSpeedAnalyzer', () => {
  it('returns valid report shape with metrics/fleetAvgIntegrationScore/slowLearners/analysisTimestamp', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgIntegrationScore');
    expect(report).toHaveProperty('slowLearners');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgIntegrationScore is a number', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    expect(typeof report.fleetAvgIntegrationScore).toBe('number');
  });

  it('slowLearners counts agents with integrationScore < 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    const expected = report.metrics.filter(m => m.integrationScore < 50).length;
    expect(report.slowLearners).toBe(expected);
  });

  it('feedbackResponseRate is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-b', 5));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      expect(m.feedbackResponseRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('repeatMistakeRate is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-c', 5));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      expect(m.repeatMistakeRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('avgIntegrationSpeedMs is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-d', 5));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgIntegrationSpeedMs).toBeGreaterThanOrEqual(0);
    }
  });

  it('integrationScore is a number', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-e', 5));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      expect(typeof m.integrationScore).toBe('number');
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-f', 5));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating is excellent|good|fair|poor', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessionsMixed('a2', 4)]);
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('rating >= 80 is excellent', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      if (m.integrationScore >= 80) expect(m.rating).toBe('excellent');
    }
  });

  it('rating < 40 is poor', async () => {
    const errorSessions = Array.from({ length: 5 }, (_, i) => ({
      id: `s-${i}`, agentId: 'bad-agent', agentName: 'Bad Agent', status: 'error',
      startedAt: new Date(now - (i + 1) * 10000), completedAt: new Date(now - i * 10000),
      createdAt: new Date(now - i * 1000),
    }));
    (db.limit as any).mockResolvedValue(errorSessions);
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (const m of report.metrics) {
      if (m.integrationScore < 40) expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by integrationScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('a1', 4),
      ...makeSessions('a2', 4),
      ...makeSessionsMixed('a3', 4),
    ]);
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].integrationScore).toBeLessThanOrEqual(report.metrics[i].integrationScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgIntegrationScore).toBe(0);
  });

  it('agent with 1 session is excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('totalFeedbackEvents matches total session count for agent', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-h', 7));
    const report = await analyzeAgentFeedbackIntegrationSpeedAnalyzer();
    expect(report.metrics[0].totalFeedbackEvents).toBe(7);
  });
});
