import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentDeadlineAdherence,
  buildDeadlineProfiles,
  computeAdherenceLevel,
  computeDelayTrend,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-deadline-adherence-service.js';

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
                summary: 'AI deadline summary.',
                recommendations: ['Improve deadline tracking.'],
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
  return {
    id: Math.random().toString(),
    personaType,
    status,
    startedAt,
    completedAt,
    createdAt: startedAt ?? new Date(),
  };
}

function makeTicket(id: string, assignedPersona: string | null = null) {
  return {
    id,
    assignedPersona,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-02'),
    status: 'done',
  };
}

describe('computeAdherenceLevel', () => {
  it('excellent for >= 85', () => expect(computeAdherenceLevel(85)).toBe('excellent'));
  it('good for >= 70', () => expect(computeAdherenceLevel(70)).toBe('good'));
  it('fair for >= 50', () => expect(computeAdherenceLevel(50)).toBe('fair'));
  it('poor for < 50', () => expect(computeAdherenceLevel(49)).toBe('poor'));
});

describe('computeDelayTrend', () => {
  it('stable when fewer than 10 delays', () => {
    expect(computeDelayTrend([10, 20, 30])).toBe('stable');
  });

  it('improving when recent avg < previous avg by >10%', () => {
    // previous 5: avg 100, recent 5: avg 50
    const delays = [100, 100, 100, 100, 100, 50, 50, 50, 50, 50];
    expect(computeDelayTrend(delays)).toBe('improving');
  });

  it('degrading when recent avg > previous avg by >10%', () => {
    const delays = [50, 50, 50, 50, 50, 100, 100, 100, 100, 100];
    expect(computeDelayTrend(delays)).toBe('degrading');
  });
});

describe('buildDeadlineProfiles', () => {
  it('returns empty array with no sessions or tickets', () => {
    const profiles = buildDeadlineProfiles([], []);
    expect(profiles).toHaveLength(0);
  });

  it('counts onTime, late, missed correctly', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const onTimeEnd = new Date('2024-01-01T01:00:00Z'); // 1h < 2h expected
    const lateEnd = new Date('2024-01-01T03:00:00Z');   // 3h > 2h expected

    const sessions = [
      makeSession('alice', 'completed', start, onTimeEnd),
      makeSession('alice', 'completed', start, lateEnd),
      makeSession('alice', 'failed', start, null),
    ];
    const profiles = buildDeadlineProfiles(sessions, []);
    const alice = profiles.find((p) => p.personaId === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.onTimeCount).toBe(1);
    expect(alice!.lateCount).toBe(1);
    expect(alice!.missedCount).toBe(1);
  });

  it('adherenceRate = onTimeCount / total * 100', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const onTimeEnd = new Date('2024-01-01T01:00:00Z');
    const sessions = [
      makeSession('bob', 'completed', start, onTimeEnd),
      makeSession('bob', 'completed', start, onTimeEnd),
      makeSession('bob', 'failed', start, null),
    ];
    const profiles = buildDeadlineProfiles(sessions, []);
    const bob = profiles.find((p) => p.personaId === 'bob');
    // 2 onTime, 0 late, 1 missed → 2/3 * 100 = 67
    expect(bob!.adherenceRate).toBe(67);
  });
});

describe('analyzeAgentDeadlineAdherence', () => {
  it('returns report with correct shape for valid projectId', async () => {
    mockDb([]);
    const result = await analyzeAgentDeadlineAdherence('proj-1');
    expect(result).toHaveProperty('projectId', 'proj-1');
    expect(result).toHaveProperty('agents');
    expect(result).toHaveProperty('systemAdherenceRate');
    expect(result).toHaveProperty('mostReliableAgent');
    expect(result).toHaveProperty('leastReliableAgent');
    expect(result).toHaveProperty('totalSlsBreaches');
    expect(result).toHaveProperty('summary');
    expect(result).toHaveProperty('recommendations');
  });

  it('mostReliableAgent = agent with highest adherenceRate', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const onTimeEnd = new Date('2024-01-01T01:00:00Z');
    const lateEnd = new Date('2024-01-01T03:00:00Z');

    const sessions = [
      makeSession('alice', 'completed', start, onTimeEnd),
      makeSession('alice', 'completed', start, onTimeEnd),
      makeSession('bob', 'completed', start, lateEnd),
      makeSession('bob', 'failed', start, null),
    ];
    const profiles = buildDeadlineProfiles(sessions, []);
    expect(profiles[0].personaId).toBe('alice');
  });

  it('leastReliableAgent = agent with lowest adherenceRate', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const onTimeEnd = new Date('2024-01-01T01:00:00Z');
    const lateEnd = new Date('2024-01-01T03:00:00Z');

    const sessions = [
      makeSession('alice', 'completed', start, onTimeEnd),
      makeSession('alice', 'completed', start, onTimeEnd),
      makeSession('bob', 'completed', start, lateEnd),
      makeSession('bob', 'failed', start, null),
    ];
    const profiles = buildDeadlineProfiles(sessions, []);
    expect(profiles[profiles.length - 1].personaId).toBe('bob');
  });

  it('totalSlsBreaches = sum of lateCount + missedCount across agents', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const lateEnd = new Date('2024-01-01T03:00:00Z');

    const sessions = [
      makeSession('alice', 'completed', start, lateEnd),
      makeSession('alice', 'failed', start, null),
      makeSession('bob', 'failed', start, null),
    ];
    const profiles = buildDeadlineProfiles(sessions, []);
    const total = profiles.reduce((s, p) => s + p.lateCount + p.missedCount, 0);
    expect(total).toBe(3); // alice: 1 late + 1 missed, bob: 1 missed
  });

  it('recommendations array has 2-3 items (fallback)', () => {
    expect(FALLBACK_RECOMMENDATIONS.length).toBeGreaterThanOrEqual(2);
    expect(FALLBACK_RECOMMENDATIONS.length).toBeLessThanOrEqual(3);
  });

  it('systemAdherenceRate = avg across agents', () => {
    const start = new Date('2024-01-01T00:00:00Z');
    const onTimeEnd = new Date('2024-01-01T01:00:00Z');
    const lateEnd = new Date('2024-01-01T03:00:00Z');

    const sessions = [
      makeSession('alice', 'completed', start, onTimeEnd), // 100%
      makeSession('bob', 'completed', start, lateEnd),     // 0%
    ];
    const profiles = buildDeadlineProfiles(sessions, []);
    const avg = Math.round(profiles.reduce((s, p) => s + p.adherenceRate, 0) / profiles.length);
    expect(avg).toBe(50);
  });

  it('uses fallback summary/recommendations when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(function () {
      return {
        messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
      };
    });
    mockDb([]);
    const result = await analyzeAgentDeadlineAdherence('proj-1');
    expect(result.summary).toBe(FALLBACK_SUMMARY);
    expect(result.recommendations).toEqual(FALLBACK_RECOMMENDATIONS);
  });
});
