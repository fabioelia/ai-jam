import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSelfCorrectionRateAnalyzer } from '../agent-self-correction-rate-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

const mockLimit = (db as any).limit as ReturnType<typeof vi.fn>;

function buildSessions(rows: unknown[]) {
  mockLimit.mockResolvedValue(rows);
}

function makeSession(personaType: string, overrides: Record<string, unknown> = {}) {
  return { id: `session-${Math.random()}`, personaType, createdAt: new Date(), ...overrides };
}

beforeEach(() => {
  vi.clearAllMocks();
  // reset chain
  (db as any).select.mockReturnThis();
  (db as any).from.mockReturnThis();
  (db as any).orderBy.mockReturnThis();
  mockLimit.mockResolvedValue([]);
});

describe('analyzeAgentSelfCorrectionRateAnalyzer', () => {
  // Test 1: returns correct report shape
  it('returns correct report shape', async () => {
    buildSessions([makeSession('a1'), makeSession('a1'), makeSession('a1')]);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgSelfCorrectionRate');
    expect(report).toHaveProperty('lowSelfCorrectors');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  // Test 2: empty sessions → empty metrics
  it('empty sessions returns empty metrics', async () => {
    buildSessions([]);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgSelfCorrectionRate).toBe(0);
    expect(report.lowSelfCorrectors).toBe(0);
  });

  // Test 3: agent with 1 session excluded
  it('agent with only 1 session is excluded from metrics', async () => {
    buildSessions([makeSession('solo')]);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  // Test 4: agent with >= 2 sessions is included
  it('agent with 2+ sessions is included in metrics', async () => {
    buildSessions([makeSession('a1'), makeSession('a1')]);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentId).toBe('a1');
    expect(report.metrics[0].agentName).toBe('a1');
  });

  // Test 5: selfCorrectionRate is 0-100
  it('selfCorrectionRate is within 0-100', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.selfCorrectionRate).toBeGreaterThanOrEqual(0);
      expect(m.selfCorrectionRate).toBeLessThanOrEqual(100);
    }
  });

  // Test 6: selfCorrected + externalCorrections === totalErrors
  it('selfCorrected + externalCorrections === totalErrors', async () => {
    const sessions = Array.from({ length: 20 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.selfCorrected + m.externalCorrections).toBe(m.totalErrors);
    }
  });

  // Test 7: correctionSpeed is positive
  it('correctionSpeed is a positive number', async () => {
    const sessions = Array.from({ length: 5 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    for (const m of report.metrics) {
      expect(m.correctionSpeed).toBeGreaterThan(0);
    }
  });

  // Test 8: trend is valid enum value
  it('trend is a valid enum value', async () => {
    const sessions = Array.from({ length: 6 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  // Test 9: rating bands match selfCorrectionRate
  it('rating band excellent when selfCorrectionRate >= 80', async () => {
    const sessions = Array.from({ length: 20 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    for (const m of report.metrics) {
      if (m.selfCorrectionRate >= 80) expect(m.rating).toBe('excellent');
      else if (m.selfCorrectionRate >= 60) expect(m.rating).toBe('good');
      else if (m.selfCorrectionRate >= 40) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  // Test 10: analysisTimestamp is a valid ISO string
  it('analysisTimestamp is a valid ISO date string', async () => {
    buildSessions([]);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  // Test 11: metrics sorted ascending by selfCorrectionRate
  it('metrics are sorted ascending by selfCorrectionRate', async () => {
    const sessions = [
      ...Array.from({ length: 5 }, () => makeSession('a1')),
      ...Array.from({ length: 5 }, () => makeSession('a2')),
      ...Array.from({ length: 5 }, () => makeSession('a3')),
    ];
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].selfCorrectionRate).toBeGreaterThanOrEqual(report.metrics[i - 1].selfCorrectionRate);
    }
  });

  // Test 12: fleetAvgSelfCorrectionRate is 0-100
  it('fleetAvgSelfCorrectionRate is within 0-100', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    expect(report.fleetAvgSelfCorrectionRate).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgSelfCorrectionRate).toBeLessThanOrEqual(100);
  });

  // Test 13: lowSelfCorrectors counts agents with selfCorrectionRate < 40
  it('lowSelfCorrectors counts agents with selfCorrectionRate < 40', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    const expected = report.metrics.filter(m => m.selfCorrectionRate < 40).length;
    expect(report.lowSelfCorrectors).toBe(expected);
  });

  // Test 14: multiple agents are all included
  it('multiple distinct agents each get a metric entry', async () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => makeSession('agentX')),
      ...Array.from({ length: 3 }, () => makeSession('agentY')),
    ];
    buildSessions(sessions);
    const report = await analyzeAgentSelfCorrectionRateAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });
});
