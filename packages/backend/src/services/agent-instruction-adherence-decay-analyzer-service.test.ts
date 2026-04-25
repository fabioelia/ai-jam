import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentInstructionAdherenceDecay,
  computeDecayRating,
} from './agent-instruction-adherence-decay-analyzer-service.js';

vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../db/connection.js';

function makeSession(agentId: string, createdAt: Date, status = 'completed') {
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: createdAt.toISOString(),
    startedAt: createdAt.toISOString(),
    completedAt: new Date(createdAt.getTime() + 30000).toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('computeDecayRating', () => {
  it('returns minimal for decayRate < 5', () => {
    expect(computeDecayRating(0)).toBe('minimal');
    expect(computeDecayRating(4)).toBe('minimal');
  });

  it('returns moderate for decayRate 5-14', () => {
    expect(computeDecayRating(5)).toBe('moderate');
    expect(computeDecayRating(14)).toBe('moderate');
  });

  it('returns high for decayRate 15-29', () => {
    expect(computeDecayRating(15)).toBe('high');
    expect(computeDecayRating(29)).toBe('high');
  });

  it('returns severe for decayRate >= 30', () => {
    expect(computeDecayRating(30)).toBe('severe');
    expect(computeDecayRating(40)).toBe('severe');
  });
});

describe('analyzeAgentInstructionAdherenceDecay', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns empty metrics for empty sessions', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(report.metrics).toHaveLength(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-solo', now)]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(report.metrics).toHaveLength(0);
  });

  it('includes agents with 2+ sessions', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(report.metrics).toHaveLength(1);
  });

  it('decayRate is non-negative', async () => {
    const now = new Date();
    const sessions = Array.from({ length: 4 }, (_, i) =>
      makeSession('agent-a', new Date(now.getTime() - i * 1000))
    );
    setupMock(sessions);
    const report = await analyzeAgentInstructionAdherenceDecay();
    for (const m of report.metrics) {
      expect(m.decayRate).toBeGreaterThanOrEqual(0);
    }
  });

  it('finalAdherence <= initialAdherence', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    for (const m of report.metrics) {
      expect(m.finalAdherence).toBeLessThanOrEqual(m.initialAdherence);
    }
  });

  it('initialAdherence in valid range (70-95)', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    for (const m of report.metrics) {
      expect(m.initialAdherence).toBeGreaterThanOrEqual(70);
      expect(m.initialAdherence).toBeLessThanOrEqual(95);
    }
  });

  it('decayRating is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    for (const m of report.metrics) {
      expect(['minimal', 'moderate', 'high', 'severe']).toContain(m.decayRating);
    }
  });

  it('trend is one of valid values', async () => {
    const now = new Date();
    setupMock([makeSession('agent-a', now), makeSession('agent-a', new Date(now.getTime() - 1000))]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    for (const m of report.metrics) {
      expect(['improving', 'stable', 'worsening']).toContain(m.trend);
    }
  });

  it('metrics sorted ascending by decayRate', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInstructionAdherenceDecay();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i].decayRate).toBeGreaterThanOrEqual(report.metrics[i - 1].decayRate);
    }
  });

  it('avgDecayRate is a number', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(typeof report.avgDecayRate).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('sessionTimelineByDecay has 7 entries', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(report.sessionTimelineByDecay).toHaveLength(7);
  });

  it('fleetTrend is one of valid values', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(['improving', 'stable', 'worsening']).toContain(report.fleetTrend);
  });

  it('mostStableAgent and highestDecayAgent are strings', async () => {
    setupMock([]);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(typeof report.mostStableAgent).toBe('string');
    expect(typeof report.highestDecayAgent).toBe('string');
  });

  it('multiple agents tracked independently', async () => {
    const now = new Date();
    const sessions = ['A', 'B', 'C'].flatMap(id =>
      [0, 1].map(i => makeSession(`agent-${id}`, new Date(now.getTime() - i * 1000)))
    );
    setupMock(sessions);
    const report = await analyzeAgentInstructionAdherenceDecay();
    expect(report.metrics).toHaveLength(3);
  });
});
