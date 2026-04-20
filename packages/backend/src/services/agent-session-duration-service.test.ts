import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentSessionDuration,
  buildDurationProfiles,
  computeDurationScore,
  computeDurationTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-session-duration-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                summary: 'AI session duration summary.',
                recommendations: ['Optimize session lengths.'],
              }),
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}

function mockDb(data: unknown[]) {
  (db as any).select.mockImplementation(() => makeSelectChain(data));
}

beforeEach(() => { vi.clearAllMocks(); });

function makeSession(
  personaType: string,
  status: string,
  startedAt: Date | null,
  completedAt: Date | null,
) {
  return { id: Math.random().toString(), personaType, status, startedAt, completedAt };
}

describe('computeDurationScore', () => {
  it('base score capped at 100 for outputPerMinute >= 1', () => {
    const score = computeDurationScore(1.0, 20, 0, 0);
    expect(score).toBe(100); // 100 + 10 bonus, clamped to 100
  });

  it('bonus +10 when avgDuration between 10-45 minutes', () => {
    const scoreWithBonus = computeDurationScore(0.5, 20, 0, 0);
    const scoreNoBonus = computeDurationScore(0.5, 60, 0, 0);
    expect(scoreWithBonus).toBeGreaterThan(scoreNoBonus);
  });

  it('penalty -10 when microRate > 0.5', () => {
    const scoreWithPenalty = computeDurationScore(0.5, 20, 0.6, 0);
    const scoreNoPenalty = computeDurationScore(0.5, 20, 0, 0);
    expect(scoreWithPenalty).toBeLessThan(scoreNoPenalty);
  });

  it('penalty -15 when longRate > 0.3', () => {
    const scoreWithPenalty = computeDurationScore(0.5, 20, 0, 0.4);
    const scoreNoPenalty = computeDurationScore(0.5, 20, 0, 0);
    expect(scoreWithPenalty).toBeLessThan(scoreNoPenalty);
  });
});

describe('computeDurationTier', () => {
  it('efficient when score >= 80 and avgDuration <= 30', () => {
    expect(computeDurationTier(85, 25)).toBe('efficient');
  });

  it('optimal when score >= 60 but not efficient', () => {
    expect(computeDurationTier(70, 40)).toBe('optimal');
  });

  it('extended when avgDuration > 60 or score < 60', () => {
    expect(computeDurationTier(55, 70)).toBe('extended');
  });

  it('excessive when avgDuration > 120 or score < 40', () => {
    expect(computeDurationTier(35, 50)).toBe('excessive');
    expect(computeDurationTier(50, 130)).toBe('excessive');
  });
});

describe('buildDurationProfiles', () => {
  it('returns empty array with no sessions', () => {
    expect(buildDurationProfiles([])).toHaveLength(0);
  });

  it('counts completed sessions correctly', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const end = new Date('2024-01-01T00:20:00Z'); // 20 min
    const sessions = [
      makeSession('alice', 'completed', start, end),
      makeSession('alice', 'failed', start, end),
    ];
    const profiles = buildDurationProfiles(sessions);
    const alice = profiles.find((p) => p.personaId === 'alice');
    expect(alice!.completedSessions).toBe(1);
    expect(alice!.totalSessions).toBe(2);
  });

  it('counts micro and long sessions correctly', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const microEnd = new Date('2024-01-01T00:03:00Z');  // 3 min < 5 min
    const longEnd = new Date('2024-01-01T01:30:00Z');    // 90 min > 60 min
    const sessions = [
      makeSession('bob', 'completed', start, microEnd),
      makeSession('bob', 'completed', start, longEnd),
    ];
    const profiles = buildDurationProfiles(sessions);
    const bob = profiles.find((p) => p.personaId === 'bob');
    expect(bob!.microSessionCount).toBe(1);
    expect(bob!.longSessionCount).toBe(1);
  });

  it('mostEfficientAgent has highest outputPerMinute (min 3 sessions)', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const shortEnd = new Date('2024-01-01T00:10:00Z'); // 10 min
    const longEnd = new Date('2024-01-01T01:00:00Z');  // 60 min
    // alice: 3 completed in 10 min = 0.3 output/min
    // bob: 3 completed in 60 min = 0.05 output/min
    const sessions = [
      ...Array(3).fill(null).map(() => makeSession('alice', 'completed', start, shortEnd)),
      ...Array(3).fill(null).map(() => makeSession('bob', 'completed', start, longEnd)),
    ];
    const profiles = buildDurationProfiles(sessions);
    const alice = profiles.find((p) => p.personaId === 'alice');
    const bob = profiles.find((p) => p.personaId === 'bob');
    expect(alice!.outputPerMinute).toBeGreaterThan(bob!.outputPerMinute);
  });
});

describe('analyzeAgentSessionDuration', () => {
  it('returns report with correct shape', async () => {
    mockDb([]);
    const result = await analyzeAgentSessionDuration('proj-1');
    expect(result).toHaveProperty('projectId', 'proj-1');
    expect(result).toHaveProperty('agents');
    expect(result).toHaveProperty('mostEfficientAgent');
    expect(result).toHaveProperty('longestRunningAgent');
    expect(result).toHaveProperty('aiSummary');
    expect(result).toHaveProperty('aiRecommendations');
  });

  it('missing completedAt sessions are excluded from duration calculation', () => {
    const sessions = [
      makeSession('charlie', 'running', new Date('2024-01-01'), null),
    ];
    const profiles = buildDurationProfiles(sessions);
    const charlie = profiles.find((p) => p.personaId === 'charlie');
    expect(charlie!.avgDurationMinutes).toBe(0);
  });

  it('uses fallback when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(function () {
      return {
        messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
      };
    });
    mockDb([]);
    const result = await analyzeAgentSessionDuration('proj-1');
    expect(result.aiSummary).toBe(FALLBACK_SUMMARY);
    expect(result.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
  });
});
