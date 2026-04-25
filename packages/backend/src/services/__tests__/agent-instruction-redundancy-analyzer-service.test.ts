import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionRedundancyAnalyzer } from '../agent-instruction-redundancy-analyzer-service.js';

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
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(),
    status: 'completed',
  }));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentInstructionRedundancyAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 3));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgRedundancyScore');
    expect(report).toHaveProperty('highRedundancyAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('empty sessions => empty metrics, fleetAvgRedundancyScore=0', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgRedundancyScore).toBe(0);
  });

  it('agent with 1 session is excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-solo', 1));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('fleetAvgRedundancyScore is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    expect(report.fleetAvgRedundancyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgRedundancyScore).toBeLessThanOrEqual(100);
  });

  it('uniqueInstructionRate is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    for (const m of report.metrics) {
      expect(m.uniqueInstructionRate).toBeGreaterThanOrEqual(0);
      expect(m.uniqueInstructionRate).toBeLessThanOrEqual(100);
    }
  });

  it('repeatInstructionRate is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    for (const m of report.metrics) {
      expect(m.repeatInstructionRate).toBeGreaterThanOrEqual(0);
      expect(m.repeatInstructionRate).toBeLessThanOrEqual(100);
    }
  });

  it('avgRedundancyDepth is a positive number', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgRedundancyDepth).toBeGreaterThan(0);
    }
  });

  it('contextRetentionRate is in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    for (const m of report.metrics) {
      expect(m.contextRetentionRate).toBeGreaterThanOrEqual(0);
      expect(m.contextRetentionRate).toBeLessThanOrEqual(100);
    }
  });

  it('redundancyTrend is one of improving/stable/worsening', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.redundancyTrend);
    }
  });

  it('rating >= 80 score => excellent (or valid rating value)', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('rating 65-79 score => good (or valid rating value)', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-1', 5));
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    for (const m of report.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by redundancyScore', async () => {
    const sessions = [
      ...makeSessions('agent-a', 4),
      ...makeSessions('agent-b', 4),
      ...makeSessions('agent-c', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInstructionRedundancyAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].redundancyScore).toBeLessThanOrEqual(
        report.metrics[report.metrics.length - 1].redundancyScore
      );
    }
  });
});
