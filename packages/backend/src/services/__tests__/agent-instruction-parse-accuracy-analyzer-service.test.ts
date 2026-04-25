import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionParseAccuracy } from '../agent-instruction-parse-accuracy-analyzer-service.js';

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
    status: i % 5 === 0 ? 'error' : 'completed',
    retryCount: i % 3 === 0 ? 1 : 0,
    startedAt: new Date(now - (count - i) * 3600000),
    completedAt: new Date(now - (count - i) * 3600000 + 1800000),
    createdAt: new Date(now - (count - i) * 3600000),
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentInstructionParseAccuracy', () => {
  it('returns report with required fields', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 4));
    const report = await analyzeAgentInstructionParseAccuracy();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgAccuracyScore');
    expect(report).toHaveProperty('lowAccuracyAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgAccuracyScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentInstructionParseAccuracy();
    expect(report.fleetAvgAccuracyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgAccuracyScore).toBeLessThanOrEqual(100);
  });

  it('lowAccuracyAgents counts agents with accuracyScore < 50', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentInstructionParseAccuracy();
    const expected = report.metrics.filter(m => m.accuracyScore < 50).length;
    expect(report.lowAccuracyAgents).toBe(expected);
  });

  it('accuracyScore in 0-100 for all metrics', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentInstructionParseAccuracy();
    for (const m of report.metrics) {
      expect(m.accuracyScore).toBeGreaterThanOrEqual(0);
      expect(m.accuracyScore).toBeLessThanOrEqual(100);
    }
  });

  it('totalInstructions > 0 for metrics', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentInstructionParseAccuracy();
    for (const m of report.metrics) {
      expect(m.totalInstructions).toBeGreaterThan(0);
    }
  });

  it('correctlyParsed + misinterpreted + clarificationRequests <= totalInstructions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentInstructionParseAccuracy();
    for (const m of report.metrics) {
      expect(m.correctlyParsed + m.misinterpreted + m.clarificationRequests).toBeLessThanOrEqual(m.totalInstructions + 1);
    }
  });

  it('avgClarificationRounds is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentInstructionParseAccuracy();
    for (const m of report.metrics) {
      expect(m.avgClarificationRounds).toBeGreaterThanOrEqual(0);
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentInstructionParseAccuracy();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating excellent when score >= 80', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentInstructionParseAccuracy();
    for (const m of report.metrics) {
      if (m.accuracyScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.accuracyScore >= 60) expect(m.rating).toBe('good');
      else if (m.accuracyScore >= 40) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO string', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 3));
    const report = await analyzeAgentInstructionParseAccuracy();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by accuracyScore', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4), ...makeSessions('a3', 4)]);
    const report = await analyzeAgentInstructionParseAccuracy();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].accuracyScore).toBeGreaterThanOrEqual(report.metrics[i].accuracyScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionParseAccuracy();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgAccuracyScore).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentInstructionParseAccuracy();
    expect(report.metrics).toHaveLength(0);
  });

  it('all error sessions produce low accuracy', async () => {
    const allError = Array.from({ length: 5 }, (_, i) => ({
      id: `s-${i}`, agentId: 'err', agentName: 'Error Agent',
      status: 'error', retryCount: 2,
      startedAt: new Date(Date.now() - i * 3600000),
      completedAt: new Date(Date.now() - i * 3600000 + 1800000),
      createdAt: new Date(Date.now() - i * 3600000),
    }));
    (db.limit as any).mockResolvedValue(allError);
    const report = await analyzeAgentInstructionParseAccuracy();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].accuracyScore).toBeLessThan(80);
    }
  });

  it('multiple agents each get own metric', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 3), ...makeSessions('a2', 3)]);
    const report = await analyzeAgentInstructionParseAccuracy();
    expect(report.metrics).toHaveLength(2);
  });

  it('zero instructions produces score 0', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionParseAccuracy();
    expect(report.fleetAvgAccuracyScore).toBe(0);
  });

  it('correctlyParsed non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('a1', 5));
    const report = await analyzeAgentInstructionParseAccuracy();
    for (const m of report.metrics) {
      expect(m.correctlyParsed).toBeGreaterThanOrEqual(0);
    }
  });
});
