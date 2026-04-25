import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTaskScopeExpansionRateAnalyzer } from '../agent-task-scope-expansion-rate-analyzer-service.js';

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

describe('analyzeAgentTaskScopeExpansionRateAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('expansion_rate');
    expect(report).toHaveProperty('total_tasks');
    expect(report).toHaveProperty('in_scope_rate');
    expect(report).toHaveProperty('minor_expansion_rate');
    expect(report).toHaveProperty('major_expansion_rate');
    expect(report).toHaveProperty('scope_violation_rate');
    expect(report).toHaveProperty('trend');
    expect(report).toHaveProperty('highest_expansion_agent');
    expect(report).toHaveProperty('lowest_expansion_agent');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.total_tasks).toBe(0);
    expect(report.expansion_rate).toBe(0);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [
      ...makeSessions('agentA', 3),
      ...makeSessions('agentB', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });

  it('high completion ratio yields low expansion rate', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 10, 1.0));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.metrics[0].expansionRate).toBeLessThanOrEqual(15);
  });

  it('zero completion ratio yields high expansion rate', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('worst', 10, 0));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.metrics[0].expansionRate).toBeGreaterThanOrEqual(40);
  });

  it('expansionRate in range 5–60', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5, 0.5));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.expansionRate).toBeGreaterThanOrEqual(5);
      expect(m.expansionRate).toBeLessThanOrEqual(60);
    }
  });

  it('inScopeTasks + expanded tasks = totalTasks', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    for (const m of report.metrics) {
      const expanded = m.minorExpansions + m.majorExpansions + m.scopeViolations;
      expect(m.inScopeTasks + expanded).toBe(m.totalTasks);
    }
  });

  it('totalTasks is at least 5', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 1));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.metrics[0].totalTasks).toBeGreaterThanOrEqual(5);
  });

  it('trend is valid enum', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(['improving', 'stable', 'worsening']).toContain(report.trend);
  });

  it('in_scope_rate + expansion_rate = ~100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5, 0.5));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(Math.abs(report.in_scope_rate + report.expansion_rate - 100)).toBeLessThanOrEqual(2);
  });

  it('metrics sorted by expansion rate descending', async () => {
    const sessions = [
      ...makeSessions('badAgent', 10, 0),
      ...makeSessions('goodAgent', 10, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].expansionRate).toBeGreaterThanOrEqual(report.metrics[1].expansionRate);
    }
  });

  it('highest_expansion_agent is first metric agentId', async () => {
    const sessions = [
      ...makeSessions('badAgent', 10, 0),
      ...makeSessions('goodAgent', 10, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.highest_expansion_agent).toBe(report.metrics[0].agentId);
  });

  it('lowest_expansion_agent is last metric agentId', async () => {
    const sessions = [
      ...makeSessions('badAgent', 10, 0),
      ...makeSessions('goodAgent', 10, 1.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.lowest_expansion_agent).toBe(report.metrics[report.metrics.length - 1].agentId);
  });

  it('scopeViolations is non-negative', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5, 0.3));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.scopeViolations).toBeGreaterThanOrEqual(0);
    }
  });

  it('all rate fields are 0–100', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 8, 0.5));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.in_scope_rate).toBeGreaterThanOrEqual(0);
    expect(report.in_scope_rate).toBeLessThanOrEqual(100);
    expect(report.minor_expansion_rate).toBeGreaterThanOrEqual(0);
    expect(report.minor_expansion_rate).toBeLessThanOrEqual(100);
    expect(report.major_expansion_rate).toBeGreaterThanOrEqual(0);
    expect(report.major_expansion_rate).toBeLessThanOrEqual(100);
    expect(report.scope_violation_rate).toBeGreaterThanOrEqual(0);
    expect(report.scope_violation_rate).toBeLessThanOrEqual(100);
  });

  it('improving trend when expansion rate is low', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('perfect', 20, 1.0));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.trend).toBe('improving');
  });

  it('single agent session handled correctly', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('solo', 1));
    const report = await analyzeAgentTaskScopeExpansionRateAnalyzer();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].totalTasks).toBeGreaterThanOrEqual(5);
  });
});
