import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeBurnoutScore,
  getBurnoutRiskTier,
  getBurnoutRiskLabel,
  analyzeBurnoutRisk,
} from '../agent-burnout-risk-service.js';

vi.mock('../../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../../db/connection.js';

const mockSelect = db.select as ReturnType<typeof vi.fn>;

function buildSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Helper to create a session row
function makeSession(
  personaType: string,
  startedAt: Date | null,
  completedAt: Date | null,
) {
  return { personaType, startedAt, completedAt };
}

// --- computeBurnoutScore ---
describe('computeBurnoutScore', () => {
  it('high sessions/day, many consecutive days, no rest = high score', () => {
    const score = computeBurnoutScore(5, 10, 0);
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it('low values yield low score', () => {
    const score = computeBurnoutScore(0, 0, 24);
    expect(score).toBe(0);
  });

  it('score is capped at 100', () => {
    const score = computeBurnoutScore(100, 100, 0);
    expect(score).toBe(100);
  });

  it('avgRestIntervalHours >= 10 contributes 0 from that term', () => {
    const scoreWithRest = computeBurnoutScore(2, 3, 10);
    const scoreMoreRest = computeBurnoutScore(2, 3, 20);
    expect(scoreWithRest).toBe(scoreMoreRest);
  });

  it('result has at most 1 decimal place', () => {
    const score = computeBurnoutScore(1.5, 3, 5);
    expect(score).toBe(Math.round(score * 10) / 10);
  });
});

// --- getBurnoutRiskTier ---
describe('getBurnoutRiskTier', () => {
  it('returns insufficient_data for totalSessions < 2', () => {
    expect(getBurnoutRiskTier(90, 1)).toBe('insufficient_data');
    expect(getBurnoutRiskTier(90, 0)).toBe('insufficient_data');
  });

  it('returns high for score >= 70', () => {
    expect(getBurnoutRiskTier(70, 5)).toBe('high');
    expect(getBurnoutRiskTier(100, 5)).toBe('high');
  });

  it('returns moderate for score >= 40 and < 70', () => {
    expect(getBurnoutRiskTier(40, 5)).toBe('moderate');
    expect(getBurnoutRiskTier(69, 5)).toBe('moderate');
  });

  it('returns low for score < 40', () => {
    expect(getBurnoutRiskTier(39, 5)).toBe('low');
    expect(getBurnoutRiskTier(0, 5)).toBe('low');
  });
});

// --- getBurnoutRiskLabel ---
describe('getBurnoutRiskLabel', () => {
  it('high -> High Risk', () => expect(getBurnoutRiskLabel('high')).toBe('High Risk'));
  it('moderate -> Moderate Risk', () => expect(getBurnoutRiskLabel('moderate')).toBe('Moderate Risk'));
  it('low -> Low Risk', () => expect(getBurnoutRiskLabel('low')).toBe('Low Risk'));
  it('insufficient_data -> Insufficient Data', () =>
    expect(getBurnoutRiskLabel('insufficient_data')).toBe('Insufficient Data'));
});

// --- analyzeBurnoutRisk integration ---
describe('analyzeBurnoutRisk', () => {
  it('returns empty agents when no sessions', async () => {
    buildSelect([]);
    const result = await analyzeBurnoutRisk('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.totalAgents).toBe(0);
    expect(result.projectId).toBe('proj1');
    expect(result.generatedAt).toBeTruthy();
  });

  it('agent with < 2 sessions gets insufficient_data tier', async () => {
    const start = new Date('2025-01-10T09:00:00Z');
    buildSelect([makeSession('AgentA', start, null)]);
    const result = await analyzeBurnoutRisk('proj1');
    expect(result.agents[0].riskTier).toBe('insufficient_data');
  });

  it('analysisWindowDays is at least 1', async () => {
    // Two sessions on the same day
    const start = new Date('2025-01-10T09:00:00Z');
    const end = new Date('2025-01-10T10:00:00Z');
    buildSelect([
      makeSession('AgentA', start, end),
      makeSession('AgentA', start, end),
    ]);
    const result = await analyzeBurnoutRisk('proj1');
    expect(result.agents[0].analysisWindowDays).toBeGreaterThanOrEqual(1);
  });

  it('sessionsPerDay = totalSessions / analysisWindowDays', async () => {
    const day1 = new Date('2025-01-10T09:00:00Z');
    const day2 = new Date('2025-01-11T09:00:00Z');
    const day3 = new Date('2025-01-12T09:00:00Z');
    buildSelect([
      makeSession('AgentB', day1, null),
      makeSession('AgentB', day2, null),
      makeSession('AgentB', day3, null),
    ]);
    const result = await analyzeBurnoutRisk('proj1');
    const agent = result.agents[0];
    expect(agent.totalSessions).toBe(3);
    expect(agent.sessionsPerDay).toBeGreaterThan(0);
  });

  it('maxConsecutiveDays correctly counts longest streak', async () => {
    // 3 consecutive days, then a gap, then 1 day
    const sessions = [
      makeSession('AgentC', new Date('2025-01-10T09:00:00Z'), null),
      makeSession('AgentC', new Date('2025-01-11T09:00:00Z'), null),
      makeSession('AgentC', new Date('2025-01-12T09:00:00Z'), null),
      makeSession('AgentC', new Date('2025-01-15T09:00:00Z'), null), // gap
    ];
    buildSelect(sessions);
    const result = await analyzeBurnoutRisk('proj1');
    expect(result.agents[0].maxConsecutiveDays).toBe(3);
  });

  it('avgRestIntervalHours is computed from completedAt to next startedAt', async () => {
    const s1Start = new Date('2025-01-10T09:00:00Z');
    const s1End = new Date('2025-01-10T10:00:00Z');
    const s2Start = new Date('2025-01-10T12:00:00Z'); // 2h gap
    const s2End = new Date('2025-01-10T13:00:00Z');
    buildSelect([
      makeSession('AgentD', s1Start, s1End),
      makeSession('AgentD', s2Start, s2End),
    ]);
    const result = await analyzeBurnoutRisk('proj1');
    expect(result.agents[0].avgRestIntervalHours).toBeCloseTo(2, 1);
  });

  it('longestSessionMs is max duration among completed sessions', async () => {
    const s1Start = new Date('2025-01-10T09:00:00Z');
    const s1End = new Date('2025-01-10T10:00:00Z'); // 3600000 ms
    const s2Start = new Date('2025-01-10T11:00:00Z');
    const s2End = new Date('2025-01-10T13:00:00Z'); // 7200000 ms
    buildSelect([
      makeSession('AgentE', s1Start, s1End),
      makeSession('AgentE', s2Start, s2End),
    ]);
    const result = await analyzeBurnoutRisk('proj1');
    expect(result.agents[0].longestSessionMs).toBe(7200000);
  });

  it('aiSummary and aiRecommendations are non-empty', async () => {
    buildSelect([]);
    const result = await analyzeBurnoutRisk('proj1');
    expect(typeof result.aiSummary).toBe('string');
    expect(result.aiSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.aiRecommendations)).toBe(true);
    expect(result.aiRecommendations.length).toBeGreaterThan(0);
  });

  it('summary counts match agent tier distribution', async () => {
    // Agent with enough sessions for high risk: many sessions/day
    const baseDate = new Date('2025-01-01T09:00:00Z');
    const sessions: ReturnType<typeof makeSession>[] = [];
    for (let i = 0; i < 10; i++) {
      const start = new Date(baseDate.getTime() + i * 60 * 60 * 1000); // every hour
      sessions.push(makeSession('HighRiskAgent', start, null));
    }
    buildSelect(sessions);
    const result = await analyzeBurnoutRisk('proj1');
    expect(result.summary.totalAgents).toBe(result.agents.length);
    const total =
      result.summary.highRiskCount +
      result.summary.moderateRiskCount +
      result.summary.lowRiskCount +
      result.agents.filter((a) => a.riskTier === 'insufficient_data').length;
    expect(total).toBe(result.agents.length);
  });
});
