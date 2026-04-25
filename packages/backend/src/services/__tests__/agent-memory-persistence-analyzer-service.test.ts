import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentMemoryPersistence } from '../agent-memory-persistence-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number) {
  const now = Date.now();
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    status: 'completed',
    retryCount: 0,
    startedAt: new Date(now - (count - i) * 3600000),
    completedAt: new Date(now - (count - i) * 3600000 + 1800000),
    createdAt: new Date(now - (count - i) * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentMemoryPersistence', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentMemoryPersistence();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetContextRecallRate');
    expect(report).toHaveProperty('poorMemoryAgents');
    expect(report).toHaveProperty('excellentMemoryAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentMemoryPersistence();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetContextRecallRate).toBe(0);
    expect(report.poorMemoryAgents).toBe(0);
    expect(report.excellentMemoryAgents).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentMemoryPersistence();
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetContextRecallRate in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 5), ...makeSessions('a2', 5)]);
    const report = await analyzeAgentMemoryPersistence();
    expect(report.fleetContextRecallRate).toBeGreaterThanOrEqual(0);
    expect(report.fleetContextRecallRate).toBeLessThanOrEqual(100);
  });

  it('contextRecallRate in 0-100 per metric', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentMemoryPersistence();
    for (const m of report.metrics) {
      expect(m.contextRecallRate).toBeGreaterThanOrEqual(0);
      expect(m.contextRecallRate).toBeLessThanOrEqual(100);
    }
  });

  it('memoryDecayRate in 0-100 per metric', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentMemoryPersistence();
    for (const m of report.metrics) {
      expect(m.memoryDecayRate).toBeGreaterThanOrEqual(0);
      expect(m.memoryDecayRate).toBeLessThanOrEqual(100);
    }
  });

  it('contradictionRate in 0-100 per metric', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 6));
    const report = await analyzeAgentMemoryPersistence();
    for (const m of report.metrics) {
      expect(m.contradictionRate).toBeGreaterThanOrEqual(0);
      expect(m.contradictionRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgSessionTurnsBeforeDecay is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentMemoryPersistence();
    for (const m of report.metrics) {
      expect(m.avgSessionTurnsBeforeDecay).toBeGreaterThan(0);
    }
  });

  it('persistenceTrend is valid value', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentMemoryPersistence();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'declining']).toContain(m.persistenceTrend);
    }
  });

  it('memoryHealth reflects correct bands', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentMemoryPersistence();
    for (const m of report.metrics) {
      if (m.contextRecallRate >= 85 && m.memoryDecayRate < 15) expect(m.memoryHealth).toBe('excellent');
      else if (m.contextRecallRate >= 70 && m.memoryDecayRate < 30) expect(m.memoryHealth).toBe('good');
      else if (m.contextRecallRate >= 50) expect(m.memoryHealth).toBe('degraded');
      else expect(m.memoryHealth).toBe('poor');
    }
  });

  it('poorMemoryAgents counts poor or degraded', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentMemoryPersistence();
    const expected = report.metrics.filter(m => m.memoryHealth === 'poor' || m.memoryHealth === 'degraded').length;
    expect(report.poorMemoryAgents).toBe(expected);
  });

  it('excellentMemoryAgents counts excellent', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentMemoryPersistence();
    const expected = report.metrics.filter(m => m.memoryHealth === 'excellent').length;
    expect(report.excellentMemoryAgents).toBe(expected);
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentMemoryPersistence();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by contextRecallRate', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentMemoryPersistence();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].contextRecallRate).toBeGreaterThanOrEqual(report.metrics[i].contextRecallRate);
    }
  });

  it('multiple agents get separate metrics', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentMemoryPersistence();
    expect(report.metrics).toHaveLength(2);
  });
});
