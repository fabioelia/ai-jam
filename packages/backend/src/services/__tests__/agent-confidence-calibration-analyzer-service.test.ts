import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentConfidenceCalibrationAnalyzer } from '../agent-confidence-calibration-analyzer-service.js';

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
  (db as any).select.mockReturnThis();
  (db as any).from.mockReturnThis();
  (db as any).orderBy.mockReturnThis();
  mockLimit.mockResolvedValue([]);
});

describe('analyzeAgentConfidenceCalibrationAnalyzer', () => {
  // Test 1: returns correct report shape
  it('returns correct report shape', async () => {
    buildSessions([makeSession('a1'), makeSession('a1'), makeSession('a1')]);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    expect(report).toHaveProperty('metrics');
    expect(report).toHaveProperty('fleetAvgCalibrationScore');
    expect(report).toHaveProperty('poorlyCalibrated');
    expect(report).toHaveProperty('analysisTimestamp');
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  // Test 2: empty sessions → empty metrics
  it('empty sessions returns empty metrics', async () => {
    buildSessions([]);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgCalibrationScore).toBe(0);
    expect(report.poorlyCalibrated).toBe(0);
  });

  // Test 3: agent with 1 session excluded
  it('agent with only 1 session is excluded from metrics', async () => {
    buildSessions([makeSession('solo')]);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  // Test 4: agent with >= 2 sessions is included
  it('agent with 2+ sessions is included in metrics', async () => {
    buildSessions([makeSession('a1'), makeSession('a1')]);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(1);
    expect(report.metrics[0].agentId).toBe('a1');
  });

  // Test 5: calibrationScore is 0-100
  it('calibrationScore is within 0-100', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.calibrationScore).toBeGreaterThanOrEqual(0);
      expect(m.calibrationScore).toBeLessThanOrEqual(100);
    }
  });

  // Test 6: calibrationError = |avgConfidenceExpressed - avgActualAccuracy|
  it('calibrationError equals absolute difference between confidence and accuracy', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.calibrationError).toBe(Math.abs(m.avgConfidenceExpressed - m.avgActualAccuracy));
    }
  });

  // Test 7: calibrationScore = max(0, 100 - calibrationError * 2)
  it('calibrationScore = max(0, 100 - calibrationError * 2)', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (const m of report.metrics) {
      const expected = Math.max(0, Math.round(100 - m.calibrationError * 2));
      expect(m.calibrationScore).toBe(expected);
    }
  });

  // Test 8: avgConfidenceExpressed is 0-100
  it('avgConfidenceExpressed is within 0-100', async () => {
    const sessions = Array.from({ length: 5 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgConfidenceExpressed).toBeGreaterThanOrEqual(0);
      expect(m.avgConfidenceExpressed).toBeLessThanOrEqual(100);
    }
  });

  // Test 9: avgActualAccuracy is 0-100
  it('avgActualAccuracy is within 0-100', async () => {
    const sessions = Array.from({ length: 5 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(m.avgActualAccuracy).toBeGreaterThanOrEqual(0);
      expect(m.avgActualAccuracy).toBeLessThanOrEqual(100);
    }
  });

  // Test 10: trend is valid enum value
  it('trend is a valid enum value', async () => {
    const sessions = Array.from({ length: 6 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  // Test 11: rating bands match calibrationScore
  it('rating band matches calibrationScore thresholds', async () => {
    const sessions = Array.from({ length: 20 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (const m of report.metrics) {
      if (m.calibrationScore >= 80) expect(m.rating).toBe('excellent');
      else if (m.calibrationScore >= 65) expect(m.rating).toBe('good');
      else if (m.calibrationScore >= 50) expect(m.rating).toBe('fair');
      else expect(m.rating).toBe('poor');
    }
  });

  // Test 12: analysisTimestamp is a valid ISO string
  it('analysisTimestamp is a valid ISO date string', async () => {
    buildSessions([]);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  // Test 13: metrics sorted ascending by calibrationScore
  it('metrics are sorted ascending by calibrationScore', async () => {
    const sessions = [
      ...Array.from({ length: 5 }, () => makeSession('a1')),
      ...Array.from({ length: 5 }, () => makeSession('a2')),
      ...Array.from({ length: 5 }, () => makeSession('a3')),
    ];
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].calibrationScore).toBeGreaterThanOrEqual(report.metrics[i - 1].calibrationScore);
    }
  });

  // Test 14: fleetAvgCalibrationScore is 0-100
  it('fleetAvgCalibrationScore is within 0-100', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    expect(report.fleetAvgCalibrationScore).toBeGreaterThanOrEqual(0);
    expect(report.fleetAvgCalibrationScore).toBeLessThanOrEqual(100);
  });

  // Test 15: poorlyCalibrated counts agents with calibrationScore < 50
  it('poorlyCalibrated counts agents with calibrationScore < 50', async () => {
    const sessions = Array.from({ length: 10 }, () => makeSession('a1'));
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    const expected = report.metrics.filter(m => m.calibrationScore < 50).length;
    expect(report.poorlyCalibrated).toBe(expected);
  });

  // Test 16: multiple agents are all included
  it('multiple distinct agents each get a metric entry', async () => {
    const sessions = [
      ...Array.from({ length: 3 }, () => makeSession('agentX')),
      ...Array.from({ length: 3 }, () => makeSession('agentY')),
    ];
    buildSessions(sessions);
    const report = await analyzeAgentConfidenceCalibrationAnalyzer();
    expect(report.metrics).toHaveLength(2);
  });
});
