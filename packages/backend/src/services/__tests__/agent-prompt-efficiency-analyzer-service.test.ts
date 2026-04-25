import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentPromptEfficiencyAnalyzer } from '../agent-prompt-efficiency-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, id: string) {
  return { id, agentId, createdAt: new Date() };
}

describe('analyzeAgentPromptEfficiencyAnalyzer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns valid report shape', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'), makeSession('a1', 's3'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgPromptEfficiencyScore');
    expect(report).toHaveProperty('lowEfficiencyAgents');
    expect(report).toHaveProperty('analysisTimestamp');
  });

  it('fleetAvgPromptEfficiencyScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
      makeSession('a2', 's3'), makeSession('a2', 's4'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    expect(report.fleetAvgPromptEfficiencyScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgPromptEfficiencyScore).toBeLessThanOrEqual(100);
  });

  it('lowEfficiencyAgents counts agents with score < 50', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    const expected = report.metrics.filter(m => m.promptEfficiencyScore < 50).length;
    expect(report.lowEfficiencyAgents).toBe(expected);
  });

  it('promptEfficiencyScore in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'), makeSession('a1', 's3'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.promptEfficiencyScore).toBeGreaterThanOrEqual(0);
      expect(m.promptEfficiencyScore).toBeLessThanOrEqual(100);
    }
  });

  it('avgTokensPerTask is a positive number', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgTokensPerTask).toBeGreaterThan(0);
    }
  });

  it('avgTasksPerKTokens is a positive number', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgTasksPerKTokens).toBeGreaterThan(0);
    }
  });

  it('verbosityRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.verbosityRate).toBeGreaterThanOrEqual(0);
      expect(m.verbosityRate).toBeLessThanOrEqual(100);
    }
  });

  it('concisencyRate in 0-100 range', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.concisencyRate).toBeGreaterThanOrEqual(0);
      expect(m.concisencyRate).toBeLessThanOrEqual(100);
    }
  });

  it('totalTokensEstimate is a positive number', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(m.totalTokensEstimate).toBeGreaterThan(0);
    }
  });

  it('trend is one of improving | stable | degrading', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'), makeSession('a1', 's3'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating correct for score bands', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (const m of report.metrics) {
      if (m.promptEfficiencyScore >= 85) expect(m.rating).toBe('excellent');
      else if (m.promptEfficiencyScore >= 70) expect(m.rating).toBe('good');
      else if (m.promptEfficiencyScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted ascending by promptEfficiencyScore', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
      makeSession('a2', 's3'), makeSession('a2', 's4'),
      makeSession('a3', 's5'), makeSession('a3', 's6'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].promptEfficiencyScore).toBeGreaterThanOrEqual(report.metrics[i - 1].promptEfficiencyScore);
    }
  });

  it('empty sessions returns empty metrics array', async () => {
    (db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgPromptEfficiencyScore).toBe(0);
  });

  it('agent with 1 session excluded', async () => {
    (db.limit as any).mockResolvedValue([makeSession('a1', 's1')]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('multiple agents all have valid fields', async () => {
    (db.limit as any).mockResolvedValue([
      makeSession('a1', 's1'), makeSession('a1', 's2'),
      makeSession('a2', 's3'), makeSession('a2', 's4'),
    ]);
    const report = await analyzeAgentPromptEfficiencyAnalyzer();
    expect(report.metrics).toHaveLength(2);
    for (const m of report.metrics) {
      expect(m.agentId).toBeDefined();
      expect(m.agentName).toBeDefined();
    }
  });
});
