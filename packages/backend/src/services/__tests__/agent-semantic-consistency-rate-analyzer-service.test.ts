import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSemanticConsistencyRateAnalyzer } from '../agent-semantic-consistency-rate-analyzer-service.js';

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

describe('analyzeAgentSemanticConsistencyRateAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgConsistencyRate');
    expect(report).toHaveProperty('stableAgents');
    expect(report).toHaveProperty('degradingAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgConsistencyRate).toBe(0);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [
      ...makeSessions('agentA', 3),
      ...makeSessions('agentB', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });

  it('high completion ratio yields high consistency rate', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 10, 1.0));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.metrics[0].semanticConsistencyRate).toBeGreaterThanOrEqual(80);
  });

  it('semanticConsistencyRate in range 55–98', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.semanticConsistencyRate).toBeGreaterThanOrEqual(55);
      expect(m.semanticConsistencyRate).toBeLessThanOrEqual(98);
    }
  });

  it('consistentResponses + inconsistentResponses = totalPromptPairs', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.consistentResponses + m.inconsistentResponses).toBe(m.totalPromptPairs);
    }
  });

  it('driftScore is between 0 and 0.45', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.driftScore).toBeGreaterThanOrEqual(0);
      expect(m.driftScore).toBeLessThanOrEqual(0.45);
    }
  });

  it('stabilityTrend is valid enum value', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    const valid = ['improving', 'stable', 'degrading'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.stabilityTrend);
    }
  });

  it('consistencyByCategory has 3–4 entries', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.consistencyByCategory.length).toBeGreaterThanOrEqual(3);
      expect(m.consistencyByCategory.length).toBeLessThanOrEqual(4);
    }
  });

  it('consistencyByCategory entries have category and rate', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    const m = report.metrics[0];
    expect(m.consistencyByCategory[0]).toHaveProperty('category');
    expect(m.consistencyByCategory[0]).toHaveProperty('rate');
  });

  it('totalPromptPairs is at least 10', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 1));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.metrics[0].totalPromptPairs).toBeGreaterThanOrEqual(10);
  });

  it('degrading trend for low completion ratio', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('worst', 10, 0));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.metrics[0].stabilityTrend).toBe('degrading');
  });

  it('fleetAvgConsistencyRate aggregates correctly', async () => {
    const sessions = [
      ...makeSessions('agentA', 5, 1.0),
      ...makeSessions('agentB', 5, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.fleetAvgConsistencyRate).toBeGreaterThanOrEqual(80);
  });

  it('stableAgents count is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.stableAgents).toBeGreaterThanOrEqual(0);
  });

  it('degradingAgents count is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    expect(report.degradingAgents).toBeGreaterThanOrEqual(0);
  });

  it('metrics sorted by consistency rate descending', async () => {
    const sessions = [
      ...makeSessions('badAgent', 10, 0),
      ...makeSessions('goodAgent', 10, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentSemanticConsistencyRateAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].semanticConsistencyRate).toBeGreaterThanOrEqual(report.metrics[1].semanticConsistencyRate);
    }
  });
});
