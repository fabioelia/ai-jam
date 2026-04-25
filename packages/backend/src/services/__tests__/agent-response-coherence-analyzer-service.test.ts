import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentResponseCoherence } from '../agent-response-coherence-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, errorRate = 0.2) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: Math.random() < errorRate ? 'error' : 'completed',
    retryCount: i % 3 === 0 ? 1 : 0,
    startedAt: new Date(now - (count - i) * 3600000),
    completedAt: new Date(now - (count - i) * 3600000 + 1800000),
    createdAt: new Date(now - (count - i) * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentResponseCoherence', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentResponseCoherence();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('coherenceScore');
    expect(report).toHaveProperty('incoherentResponses');
    expect(report).toHaveProperty('contradictionCount');
    expect(report).toHaveProperty('reasoningGapCount');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('mostCoherentAgent');
    expect(report).toHaveProperty('leastCoherentAgent');
    expect(report).toHaveProperty('fleetAvgCoherenceScore');
    expect(report).toHaveProperty('lowCoherenceAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('empty sessions returns zeros', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentResponseCoherence();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgCoherenceScore).toBe(0);
    expect(report.lowCoherenceAgents).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentResponseCoherence();
    expect(report.metrics).toHaveLength(0);
  });

  it('coherenceScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 5), ...makeSessions('a2', 5)]);
    const report = await analyzeAgentResponseCoherence();
    expect(report.fleetAvgCoherenceScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgCoherenceScore).toBeLessThanOrEqual(100);
  });

  it('per-agent coherenceScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentResponseCoherence();
    for (const m of report.metrics) {
      expect(m.coherenceScore).toBeGreaterThanOrEqual(0);
      expect(m.coherenceScore).toBeLessThanOrEqual(100);
    }
  });

  it('incoherentResponses <= totalResponses', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentResponseCoherence();
    for (const m of report.metrics) {
      expect(m.incoherentResponses).toBeLessThanOrEqual(m.totalResponses);
    }
  });

  it('totalResponses > 0 for metrics', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentResponseCoherence();
    for (const m of report.metrics) {
      expect(m.totalResponses).toBeGreaterThan(0);
    }
  });

  it('trend is valid value', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentResponseCoherence();
    expect(['improving', 'stable', 'degrading']).toContain(report.trend);
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating reflects coherenceScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentResponseCoherence();
    for (const m of report.metrics) {
      if (m.coherenceScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.coherenceScore >= 60) expect(m.rating).toBe('good');
      else if (m.coherenceScore >= 40) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('lowCoherenceAgents counts correctly', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentResponseCoherence();
    const expected = report.metrics.filter(m => m.coherenceScore < 50).length;
    expect(report.lowCoherenceAgents).toBe(expected);
  });

  it('metrics sorted descending by coherenceScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentResponseCoherence();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].coherenceScore).toBeGreaterThanOrEqual(report.metrics[i].coherenceScore);
    }
  });

  it('multiple agents get separate metrics', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentResponseCoherence();
    expect(report.metrics).toHaveLength(2);
  });

  it('all-error sessions produce low coherence', async () => {
    const allError = Array.from({ length: 5 }, (_, i) => ({
      id: `s-${i}`, agentId: 'err', agentName: 'Error Agent',
      status: 'error', retryCount: 2,
      startedAt: new Date(Date.now() - i * 3600000),
      completedAt: new Date(Date.now() - i * 3600000 + 1800000),
      createdAt: new Date(Date.now() - i * 3600000),
    }));
    (db.limit as any).mockResolvedValue(allError);
    const report = await analyzeAgentResponseCoherence();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].coherenceScore).toBeLessThan(90);
    }
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentResponseCoherence();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('mostCoherentAgent and leastCoherentAgent are strings', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentResponseCoherence();
    expect(typeof report.mostCoherentAgent).toBe('string');
    expect(typeof report.leastCoherentAgent).toBe('string');
  });

  it('contradictionCount non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentResponseCoherence();
    for (const m of report.metrics) {
      expect(m.contradictionCount).toBeGreaterThanOrEqual(0);
      expect(m.reasoningGapCount).toBeGreaterThanOrEqual(0);
    }
  });
});
