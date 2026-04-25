import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentInstructionComplexity } from '../agent-instruction-complexity-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

const mockDb = await import('../../db/connection.js');

function makeSessions(agentId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `session-${agentId}-${i}`,
    agentId,
    agentName: `Agent ${agentId}`,
    createdAt: new Date(Date.now() - i * 3600000),
    completedAt: new Date(Date.now() - i * 3600000 + 1800000),
    startedAt: new Date(Date.now() - i * 3600000),
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  (mockDb.db.select as any).mockReturnThis();
  (mockDb.db.from as any).mockReturnThis();
  (mockDb.db.orderBy as any).mockReturnThis();
});

describe('analyzeAgentInstructionComplexity', () => {
  it('returns valid report shape', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionComplexity();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgComplexityScore');
    expect(report).toHaveProperty('criticalComplexityAgents');
    expect(report).toHaveProperty('simpleInstructionAgents');
    expect(report).toHaveProperty('topComplexInstructions');
    expect(report).toHaveProperty('recommendations');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('fleetAvgComplexityScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-a', 3));
    const report = await analyzeAgentInstructionComplexity();
    expect(report.fleetAvgComplexityScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgComplexityScore).toBeLessThanOrEqual(100);
  });

  it('criticalComplexityAgents counts agents with complexityScore >= 75', async () => {
    const sessions = [...makeSessions('agent-b', 4), ...makeSessions('agent-c', 4)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInstructionComplexity();
    const expected = report.metrics.filter(m => m.complexityScore >= 75).length;
    expect(report.criticalComplexityAgents).toBe(expected);
  });

  it('simpleInstructionAgents counts agents with complexityScore < 25', async () => {
    const sessions = [...makeSessions('agent-d', 4), ...makeSessions('agent-e', 4)];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInstructionComplexity();
    const expected = report.metrics.filter(m => m.complexityScore < 25).length;
    expect(report.simpleInstructionAgents).toBe(expected);
  });

  it('complexityScore is in 0-100 per metric', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-f', 3));
    const report = await analyzeAgentInstructionComplexity();
    for (const m of report.metrics) {
      expect(m.complexityScore).toBeGreaterThanOrEqual(0);
      expect(m.complexityScore).toBeLessThanOrEqual(100);
    }
  });

  it('avgInstructionLength is positive', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-g', 3));
    const report = await analyzeAgentInstructionComplexity();
    for (const m of report.metrics) {
      expect(m.avgInstructionLength).toBeGreaterThan(0);
    }
  });

  it('ambiguityScore is in 0-100', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-h', 3));
    const report = await analyzeAgentInstructionComplexity();
    for (const m of report.metrics) {
      expect(m.ambiguityScore).toBeGreaterThanOrEqual(0);
      expect(m.ambiguityScore).toBeLessThanOrEqual(100);
    }
  });

  it('conditionalBranchCount is >= 0', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-i', 3));
    const report = await analyzeAgentInstructionComplexity();
    for (const m of report.metrics) {
      expect(m.conditionalBranchCount).toBeGreaterThanOrEqual(0);
    }
  });

  it('multiStepDepth is >= 1', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-j', 3));
    const report = await analyzeAgentInstructionComplexity();
    for (const m of report.metrics) {
      expect(m.multiStepDepth).toBeGreaterThanOrEqual(1);
    }
  });

  it('complexityTrend is one of increasing|stable|decreasing', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-k', 4));
    const report = await analyzeAgentInstructionComplexity();
    for (const m of report.metrics) {
      expect(['increasing', 'stable', 'decreasing']).toContain(m.complexityTrend);
    }
  });

  it('complexityLevel correct for score bands', async () => {
    (mockDb.db.limit as any).mockResolvedValue(makeSessions('agent-l', 4));
    const report = await analyzeAgentInstructionComplexity();
    for (const m of report.metrics) {
      const expected =
        m.complexityScore >= 75 ? 'critical' :
        m.complexityScore >= 50 ? 'complex' :
        m.complexityScore >= 25 ? 'moderate' : 'simple';
      expect(m.complexityLevel).toBe(expected);
    }
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionComplexity();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('metrics sorted descending by complexityScore', async () => {
    const sessions = [
      ...makeSessions('agent-m', 5),
      ...makeSessions('agent-n', 4),
      ...makeSessions('agent-o', 3),
    ];
    (mockDb.db.limit as any).mockResolvedValue(sessions);
    const report = await analyzeAgentInstructionComplexity();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].complexityScore).toBeLessThanOrEqual(report.metrics[i - 1].complexityScore);
    }
  });

  it('topComplexInstructions is non-empty array', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionComplexity();
    expect(Array.isArray(report.topComplexInstructions)).toBe(true);
    expect(report.topComplexInstructions.length).toBeGreaterThan(0);
  });

  it('recommendations is non-empty array', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionComplexity();
    expect(Array.isArray(report.recommendations)).toBe(true);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('empty sessions returns empty metrics array', async () => {
    (mockDb.db.limit as any).mockResolvedValue([]);
    const report = await analyzeAgentInstructionComplexity();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgComplexityScore).toBe(0);
  });
});
