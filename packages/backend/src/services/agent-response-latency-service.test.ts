import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentResponseLatency,
  buildLatencyProfiles,
  computeLatencyTier,
  computeMedian,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-response-latency-service.js';

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
                summary: 'AI latency summary.',
                recommendations: ['Reduce session stalls.'],
              }),
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';

type SessionRow = {
  personaType: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

function makeSession(personaType: string, durationMinutes: number): SessionRow {
  const startedAt = new Date('2026-01-01T00:00:00Z');
  const completedAt = new Date(startedAt.getTime() + durationMinutes * 60000);
  return { personaType, startedAt, completedAt };
}

function mockDb(tickets: { id: string }[], sessions: SessionRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      return Promise.resolve(sessions);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: latencyTier thresholds
it('assigns latencyTier correctly based on avgDurationMinutes', () => {
  expect(computeLatencyTier(0)).toBe('fast');
  expect(computeLatencyTier(4.9)).toBe('fast');
  expect(computeLatencyTier(5)).toBe('moderate');
  expect(computeLatencyTier(14.9)).toBe('moderate');
  expect(computeLatencyTier(15)).toBe('slow');
  expect(computeLatencyTier(29.9)).toBe('slow');
  expect(computeLatencyTier(30)).toBe('stalled');
  expect(computeLatencyTier(60)).toBe('stalled');
});

// Test 2: fastCompletionRate formula
it('computes fastCompletionRate correctly', () => {
  const sessions: SessionRow[] = [
    makeSession('AgentA', 3),   // under 5min
    makeSession('AgentA', 4),   // under 5min
    makeSession('AgentA', 10),  // not under 5min
    makeSession('AgentA', 20),  // not under 5min
  ];
  const profiles = buildLatencyProfiles(sessions);
  const agent = profiles.find((p) => p.personaId === 'AgentA')!;
  expect(agent.sessionsUnder5min).toBe(2);
  expect(agent.fastCompletionRate).toBe(50);
});

// Test 3: stallRate formula
it('computes stallRate correctly', () => {
  const sessions: SessionRow[] = [
    makeSession('AgentB', 5),
    makeSession('AgentB', 35),  // stalled
    makeSession('AgentB', 60),  // stalled
    makeSession('AgentB', 10),
  ];
  const profiles = buildLatencyProfiles(sessions);
  const agent = profiles.find((p) => p.personaId === 'AgentB')!;
  expect(agent.sessionsOver30min).toBe(2);
  expect(agent.stallRate).toBe(50);
});

// Test 4: fastest/slowest agent selection (min 3 sessions)
it('selects fastestAgent and slowestAgent with min 3 sessions', async () => {
  const tickets = [{ id: 't1' }, { id: 't2' }];
  const sessions: SessionRow[] = [
    // AgentFast: avg 2min (3 sessions → qualifies)
    makeSession('AgentFast', 1),
    makeSession('AgentFast', 2),
    makeSession('AgentFast', 3),
    // AgentSlow: avg 40min (3 sessions → qualifies)
    makeSession('AgentSlow', 35),
    makeSession('AgentSlow', 40),
    makeSession('AgentSlow', 45),
  ];
  mockDb(tickets, sessions);
  const report = await analyzeAgentResponseLatency('proj-1');
  expect(report.fastestAgent).toBe('AgentFast');
  expect(report.slowestAgent).toBe('AgentSlow');
});

// Test 5: stallRiskCount
it('counts agents with stallRate > 20%', async () => {
  const tickets = [{ id: 't1' }];
  const sessions: SessionRow[] = [
    // AgentX: 1 stall out of 3 = 33% → risk
    makeSession('AgentX', 35),
    makeSession('AgentX', 5),
    makeSession('AgentX', 5),
    // AgentY: 0 stalls out of 3 = 0% → no risk
    makeSession('AgentY', 5),
    makeSession('AgentY', 5),
    makeSession('AgentY', 5),
  ];
  mockDb(tickets, sessions);
  const report = await analyzeAgentResponseLatency('proj-1');
  expect(report.stallRiskCount).toBe(1);
});

// Test 6: empty project returns empty report
it('returns empty report when project has no tickets', async () => {
  mockDb([], []);
  const report = await analyzeAgentResponseLatency('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.fastestAgent).toBeNull();
  expect(report.slowestAgent).toBeNull();
  expect(report.avgProjectLatencyMinutes).toBe(0);
  expect(report.stallRiskCount).toBe(0);
});

// Test 7: single session edge case — min 3 sessions not met, no fastest/slowest
it('returns null fastest/slowest when agents have fewer than 3 sessions', async () => {
  const tickets = [{ id: 't1' }];
  const sessions: SessionRow[] = [
    makeSession('AgentA', 2),
    makeSession('AgentA', 4),
  ];
  mockDb(tickets, sessions);
  const report = await analyzeAgentResponseLatency('proj-1');
  expect(report.fastestAgent).toBeNull();
  expect(report.slowestAgent).toBeNull();
});

// Test 8: AI fallback on error
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(function () {
    return {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI error')),
      },
    };
  });

  mockDb([], []);
  const report = await analyzeAgentResponseLatency('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
