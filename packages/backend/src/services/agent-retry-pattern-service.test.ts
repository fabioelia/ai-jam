import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentRetryPattern,
  buildRetryProfiles,
  computeRetryScore,
  computeRetryTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-retry-pattern-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ summary: 'test', recommendations: ['rec1'] }) }],
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

function makeSession(personaType: string, status: string, retryCount: number) {
  return { id: Math.random().toString(), personaType, status, retryCount };
}

describe('computeRetryScore', () => {
  it('score formula correct: 100 - (avgRetries * 20) + (zeroRetryRate * 0.2) - penalty', () => {
    // avgRetriesPerSession=1, zeroRetryRate=80, maxRetries=3
    // 100 - 20 + 16 - 0 = 96, clamped = 96
    const score = computeRetryScore(1, 80, 3);
    expect(score).toBe(96);
  });

  it('penalizes maxRetriesInSession > 5 (penalty -10 applied)', () => {
    // With 3 retries/session: 100 - 60 + 0 - 0 = 40, vs same with maxRetries > 5: 100 - 60 + 0 - 10 = 30
    const scoreNoPenalty = computeRetryScore(3, 0, 5);
    const scoreWithPenalty = computeRetryScore(3, 0, 6);
    expect(scoreWithPenalty).toBeLessThan(scoreNoPenalty);
  });
});

describe('computeRetryTier', () => {
  it('efficient when retryScore >= 80', () => expect(computeRetryTier(80)).toBe('efficient'));
  it('moderate when retryScore 60-79', () => expect(computeRetryTier(60)).toBe('moderate'));
  it('frequent when retryScore 40-59', () => expect(computeRetryTier(40)).toBe('frequent'));
  it('chronic when retryScore < 40', () => expect(computeRetryTier(39)).toBe('chronic'));
});

describe('buildRetryProfiles', () => {
  it('returns agents array with correct shape', () => {
    const sessions = [makeSession('alice', 'completed', 0), makeSession('alice', 'failed', 2)];
    const profiles = buildRetryProfiles(sessions);
    expect(profiles).toHaveLength(1);
    expect(profiles[0]).toHaveProperty('personaId', 'alice');
    expect(profiles[0]).toHaveProperty('totalSessions', 2);
    expect(profiles[0]).toHaveProperty('retryScore');
    expect(profiles[0]).toHaveProperty('retryTier');
  });

  it('mostEfficientAgent = agent with highest retryScore', () => {
    // alice: 0 retries → high score, bob: many retries → low score
    const sessions = [
      makeSession('alice', 'completed', 0),
      makeSession('bob', 'failed', 5),
      makeSession('bob', 'failed', 5),
    ];
    const profiles = buildRetryProfiles(sessions);
    expect(profiles[0].personaId).toBe('alice');
  });

  it('fallback summary and recommendations are defined', () => {
    expect(FALLBACK_SUMMARY).toBeTruthy();
    expect(FALLBACK_RECOMMENDATIONS).toHaveLength(1);
  });
});

describe('analyzeAgentRetryPattern', () => {
  it('returns report with agents array', async () => {
    mockDb([]);
    const result = await analyzeAgentRetryPattern('proj-1');
    expect(result).toHaveProperty('agents');
    expect(result).toHaveProperty('avgRetriesPerSession');
    expect(result).toHaveProperty('mostEfficientAgent');
    expect(result).toHaveProperty('highestRetryAgent');
    expect(result).toHaveProperty('totalRetriesAcrossAllAgents');
    expect(result).toHaveProperty('aiSummary');
    expect(result).toHaveProperty('aiRecommendations');
  });

  it('uses fallback summary/recommendations when AI unavailable', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(function () {
      return {
        messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
      };
    });
    mockDb([]);
    const result = await analyzeAgentRetryPattern('proj-1');
    expect(result.aiSummary).toBe(FALLBACK_SUMMARY);
    expect(result.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
  });
});
