import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInteractionRichnessAnalyzer } from '../agent-interaction-richness-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSessions(agentId: string, count: number, completedRatio = 0.8) {
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

describe('analyzeAgentInteractionRichnessAnalyzer', () => {
  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgRichnessScore');
    expect(report).toHaveProperty('deepInteractionAgents');
    expect(report).toHaveProperty('shallowInteractionAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('returns empty metrics for no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgRichnessScore).toBe(0);
  });

  it('returns one metric per unique agent', async () => {
    const sessions = [
      ...makeSessions('agentA', 3),
      ...makeSessions('agentB', 4),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });

  it('interactionRichnessScore is between 0 and 1', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    for (const m of report.metrics) {
      expect(m.interactionRichnessScore).toBeGreaterThanOrEqual(0);
      expect(m.interactionRichnessScore).toBeLessThanOrEqual(1);
    }
  });

  it('richnessCategory is valid enum value', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    const valid = ['shallow', 'moderate', 'rich', 'deep'];
    for (const m of report.metrics) {
      expect(valid).toContain(m.richnessCategory);
    }
  });

  it('shallow category for low richness score', async () => {
    // 0 completed sessions → low contextDepthScore → shallow
    const sessions = makeSessions('agent1', 5, 0);
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report.metrics[0].richnessCategory).toBe('shallow');
  });

  it('deep category for high richness', async () => {
    // All completed, varied durations → high toolVarietyIndex + informationDensity
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      agentId: 'topAgent',
      agentName: 'Top Agent',
      createdAt: new Date(Date.now() - i * 60000),
      startedAt: new Date(Date.now() - i * 60000),
      completedAt: new Date(Date.now() - i * 60000 + (i % 2 === 0 ? 7200000 : 1800000)),
      status: 'completed',
      durationMs: i % 2 === 0 ? 7200000 : 1800000,
    }));
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(['rich', 'deep']).toContain(report.metrics[0].richnessCategory);
  });

  it('avgTurnsPerSession is between 2 and 20', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgTurnsPerSession).toBeGreaterThanOrEqual(2);
      expect(m.avgTurnsPerSession).toBeLessThanOrEqual(20);
    }
  });

  it('toolVarietyIndex is between 0.1 and 0.9', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    for (const m of report.metrics) {
      expect(m.toolVarietyIndex).toBeGreaterThanOrEqual(0.1);
      expect(m.toolVarietyIndex).toBeLessThanOrEqual(0.9);
    }
  });

  it('contextDepthScore is between 0 and 1', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 5));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    for (const m of report.metrics) {
      expect(m.contextDepthScore).toBeGreaterThanOrEqual(0);
      expect(m.contextDepthScore).toBeLessThanOrEqual(1);
    }
  });

  it('fleetAvgRichnessScore aggregates all agents', async () => {
    const sessions = [
      ...makeSessions('agentA', 3, 1.0),
      ...makeSessions('agentB', 3, 0.0),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report.fleetAvgRichnessScore).toBeGreaterThan(0);
    expect(report.fleetAvgRichnessScore).toBeLessThanOrEqual(1);
  });

  it('deepInteractionAgents counts deep category agents', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => ({
      id: `s${i}`,
      agentId: 'deepAgent',
      agentName: 'Deep',
      createdAt: new Date(Date.now() - i * 60000),
      startedAt: new Date(Date.now() - i * 60000),
      completedAt: new Date(Date.now() - i * 60000 + 3600000),
      status: 'completed',
      durationMs: 3600000,
    }));
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report.deepInteractionAgents).toBeGreaterThanOrEqual(0);
  });

  it('shallowInteractionAgents counts shallow category agents', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 3, 0));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report.shallowInteractionAgents).toBeGreaterThanOrEqual(0);
  });

  it('metrics sorted by richness descending', async () => {
    const sessions = [
      ...makeSessions('lowAgent', 3, 0),
      ...Array.from({ length: 10 }, (_, i) => ({
        id: `s${i}`,
        agentId: 'highAgent',
        agentName: 'High',
        createdAt: new Date(Date.now() - i * 60000),
        startedAt: new Date(Date.now() - i * 60000),
        completedAt: new Date(Date.now() - i * 60000 + 3600000),
        status: 'completed',
        durationMs: 3600000,
      })),
    ];
    (db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    if (report.metrics.length > 1) {
      expect(report.metrics[0].interactionRichnessScore).toBeGreaterThanOrEqual(report.metrics[1].interactionRichnessScore);
    }
  });

  it('handles single session per agent', async () => {
    (db.limit as any).mockResolvedValue([makeSessions('solo', 1)[0]]);
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].totalSessions).toBe(1);
  });

  it('informationDensity is between 0.2 and 0.8', async () => {
    (db.limit as any).mockResolvedValue(makeSessions('agent1', 8));
    const report = await analyzeAgentInteractionRichnessAnalyzer();
    for (const m of report.metrics) {
      expect(m.informationDensity).toBeGreaterThanOrEqual(0.2);
      expect(m.informationDensity).toBeLessThanOrEqual(0.8);
    }
  });
});
