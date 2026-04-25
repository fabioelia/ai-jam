import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentKnowledgeRecencyIndexAnalyzer } from '../agent-knowledge-recency-index-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, completedRatio = 1.0) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    startedAt: new Date(Date.now() - i * 3600000),
    completedAt: i < Math.floor(count * completedRatio) ? new Date(Date.now() - i * 3600000 + 1800000) : null,
    status: i < Math.floor(count * completedRatio) ? 'completed' : 'failed',
    durationMs: i < Math.floor(count * completedRatio) ? 1800000 : null,
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentKnowledgeRecencyIndexAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgRecencyIndex');
    expect(report).toHaveProperty('fresheningAgents');
    expect(report).toHaveProperty('stalingAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgRecencyIndex).toBe(0);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [
      ...makeSessions('agentA', 3),
      ...makeSessions('agentB', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });

  it('fully fresh agent has high recency index', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('fresh', 10, 1.0));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.metrics[0].knowledgeRecencyIndex).toBeGreaterThanOrEqual(80);
  });

  it('fully stale agent has low recency index', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('stale', 10, 0));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.metrics[0].knowledgeRecencyIndex).toBeLessThanOrEqual(50);
  });

  it('knowledgeRecencyIndex in range 40–95', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    for (const m of report.metrics) {
      expect(m.knowledgeRecencyIndex).toBeGreaterThanOrEqual(40);
      expect(m.knowledgeRecencyIndex).toBeLessThanOrEqual(95);
    }
  });

  it('freshReferenceCount + staleReferenceCount = contextUpdateCount', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    for (const m of report.metrics) {
      expect(m.freshReferenceCount + m.staleReferenceCount).toBe(m.contextUpdateCount);
    }
  });

  it('recencyTrend is valid enum value', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    const valid = ['freshening', 'stable', 'staling'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.recencyTrend);
    }
  });

  it('recencyByDomain has 3–4 entries', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    for (const m of report.metrics) {
      expect(m.recencyByDomain.length).toBeGreaterThanOrEqual(3);
      expect(m.recencyByDomain.length).toBeLessThanOrEqual(4);
    }
  });

  it('recencyByDomain entries have domain and recencyScore', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    const m = report.metrics[0];
    expect(m.recencyByDomain[0]).toHaveProperty('domain');
    expect(m.recencyByDomain[0]).toHaveProperty('recencyScore');
  });

  it('avgContextAge is positive', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgContextAge).toBeGreaterThanOrEqual(1);
    }
  });

  it('staling trend for fully incomplete sessions', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('worst', 10, 0));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.metrics[0].recencyTrend).toBe('staling');
  });

  it('fleetAvgRecencyIndex aggregates correctly', async () => {
    const sessions = [
      ...makeSessions('agentA', 5, 1.0),
      ...makeSessions('agentB', 5, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.fleetAvgRecencyIndex).toBeGreaterThanOrEqual(80);
  });

  it('fresheningAgents count is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.fresheningAgents).toBeGreaterThanOrEqual(0);
  });

  it('stalingAgents count is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    expect(report.stalingAgents).toBeGreaterThanOrEqual(0);
  });

  it('metrics sorted by recency index descending', async () => {
    const sessions = [
      ...makeSessions('staleAgent', 10, 0),
      ...makeSessions('freshAgent', 10, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentKnowledgeRecencyIndexAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].knowledgeRecencyIndex).toBeGreaterThanOrEqual(report.metrics[1].knowledgeRecencyIndex);
    }
  });
});
