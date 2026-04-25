import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentWorkflowBottleneckAnalyzer } from '../agent-workflow-bottleneck-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([
      { id: 's1', agentId: 'agent-1', createdAt: new Date(), agentName: 'Alice' },
      { id: 's2', agentId: 'agent-1', createdAt: new Date(), agentName: 'Alice' },
      { id: 's3', agentId: 'agent-1', createdAt: new Date(), agentName: 'Alice' },
      { id: 's4', agentId: 'agent-2', createdAt: new Date(), agentName: 'Bob' },
      { id: 's5', agentId: 'agent-2', createdAt: new Date(), agentName: 'Bob' },
    ]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentWorkflowBottleneckAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-a', 5));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgBottleneckScore');
    expect(report).toHaveProperty('criticalBottlenecks');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgBottleneckScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    expect(report.fleetAvgBottleneckScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgBottleneckScore).toBeLessThanOrEqual(100);
  });

  it('criticalBottlenecks counts agents with severity === critical', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    const expected = report.metrics.filter(m => m.severity === 'critical').length;
    expect(report.criticalBottlenecks).toBe(expected);
  });

  it('avgQueueWaitTime is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-b', 5));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgQueueWaitTime).toBeGreaterThan(0);
    }
  });

  it('stallFrequency in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-c', 5));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(m.stallFrequency).toBeGreaterThanOrEqual(0);
      expect(m.stallFrequency).toBeLessThanOrEqual(100);
    }
  });

  it('throughputImpactScore in 0-100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-d', 5));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(m.throughputImpactScore).toBeGreaterThanOrEqual(0);
      expect(m.throughputImpactScore).toBeLessThanOrEqual(100);
    }
  });

  it('bottleneckEvents is non-negative integer', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-e', 5));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(m.bottleneckEvents).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(m.bottleneckEvents)).toBe(true);
    }
  });

  it('trend is improving|stable|degrading', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-f', 5));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('severity correct for bands (>=75=critical, >=55=high, >=35=medium, else low)', async () => {
    (db.limit as any).mockResolvedValue([...makeSessions('a1', 4), ...makeSessions('a2', 4)]);
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    for (const m of report.metrics) {
      if (m.bottleneckScore >= 75) expect(m.severity).toBe('critical');
      else if (m.bottleneckScore >= 55) expect(m.severity).toBe('high');
      else if (m.bottleneckScore >= 35) expect(m.severity).toBe('medium');
      else expect(m.severity).toBe('low');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by bottleneckScore', async () => {
    (db.limit as any).mockResolvedValue([
      ...makeSessions('a1', 4),
      ...makeSessions('a2', 4),
      ...makeSessions('a3', 4),
    ]);
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].bottleneckScore).toBeGreaterThanOrEqual(report.metrics[i].bottleneckScore);
    }
  });

  it('empty sessions returns empty metrics', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgBottleneckScore).toBe(0);
  });

  it('agent with 1 session is excluded', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentWorkflowBottleneckAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });
});
