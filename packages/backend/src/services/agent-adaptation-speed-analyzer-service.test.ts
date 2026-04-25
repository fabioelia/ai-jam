import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentAdaptationSpeedAnalyzer, computeAdaptationScore, getAdaptationRating } from './agent-adaptation-speed-analyzer-service.js';

vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../db/connection.js';

function makeSession(personaType: string) {
  return { personaType, status: 'completed', startedAt: new Date(), completedAt: new Date() };
}

describe('agent-adaptation-speed-analyzer-service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty metrics when no sessions', async () => {
    (db.limit as any).mockResolvedValue([]);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    expect(result.metrics).toEqual([]);
    expect(result.fleetAvgAdaptationScore).toBe(0);
    expect(result.slowAdapters).toBe(0);
  });

  it('returns valid report shape', async () => {
    const sessions = Array.from({ length: 10 }, (_, i) => makeSession(`agent-${i % 3}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    expect(result).toHaveProperty('metrics');
    expect(result).toHaveProperty('fleetAvgAdaptationScore');
    expect(result).toHaveProperty('slowAdapters');
    expect(result).toHaveProperty('analysisTimestamp');
  });

  it('excludes agents with < 2 sessions', async () => {
    const sessions = [makeSession('lonely-agent')];
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    expect(result.metrics).toEqual([]);
  });

  it('fleetAvgAdaptationScore in 0-100', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(`agent-${i % 4}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    expect(result.fleetAvgAdaptationScore).toBeGreaterThanOrEqual(0);
    expect(result.fleetAvgAdaptationScore).toBeLessThanOrEqual(100);
  });

  it('analysisTimestamp is valid ISO date', async () => {
    (db.limit as any).mockResolvedValue([]);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    expect(new Date(result.analysisTimestamp).toISOString()).toBe(result.analysisTimestamp);
  });

  it('metrics sorted ascending by adaptationScore', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(`agent-${i % 5}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    for (let i = 1; i < result.metrics.length; i++) {
      expect(result.metrics[i].adaptationScore).toBeGreaterThanOrEqual(result.metrics[i - 1].adaptationScore);
    }
  });

  it('trend is valid value', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(`agent-${i % 4}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    for (const m of result.metrics) {
      expect(['improving', 'stable', 'degrading']).toContain(m.trend);
    }
  });

  it('rating is valid value', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(`agent-${i % 4}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    for (const m of result.metrics) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(m.rating);
    }
  });

  it('slowAdapters counts agents with adaptationScore < 50', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(`agent-${i % 4}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    const expected = result.metrics.filter(m => m.adaptationScore < 50).length;
    expect(result.slowAdapters).toBe(expected);
  });

  it('contextSwitchLatency is positive number', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(`agent-${i % 4}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    for (const m of result.metrics) {
      expect(m.contextSwitchLatency).toBeGreaterThan(0);
    }
  });

  it('recalibrationRate in 0-100', async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => makeSession(`agent-${i % 4}`));
    (db.limit as any).mockResolvedValue(sessions);
    const result = await analyzeAgentAdaptationSpeedAnalyzer('proj-1');
    for (const m of result.metrics) {
      expect(m.recalibrationRate).toBeGreaterThanOrEqual(0);
      expect(m.recalibrationRate).toBeLessThanOrEqual(100);
    }
  });

  it('computeAdaptationScore - excellent for low latency + high rates', () => {
    const score = computeAdaptationScore(0, 100, 100);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('computeAdaptationScore - poor for high latency + low rates', () => {
    const score = computeAdaptationScore(2000, 0, 0);
    expect(score).toBeLessThan(50);
  });

  it('getAdaptationRating returns correct bands', () => {
    expect(getAdaptationRating(80)).toBe('excellent');
    expect(getAdaptationRating(65)).toBe('good');
    expect(getAdaptationRating(50)).toBe('fair');
    expect(getAdaptationRating(49)).toBe('poor');
  });
});
