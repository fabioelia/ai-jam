import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentSuccessRate,
  buildSuccessRateProfiles,
  computeReliabilityTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type SessionRow,
} from './agent-success-rate-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'AI success rate summary.',
        recommendations: ['Improve agent reliability.'],
      }),
    },
  ],
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

import { db } from '../db/connection.js';

function makeSession(
  personaType: string,
  status: string,
  startedAt: Date | null = null,
  completedAt: Date | null = null,
): SessionRow {
  return { ticketId: 't1', personaType, status, startedAt, completedAt };
}

function mockDb(ticketRows: { id: string }[], sessionRows: SessionRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(ticketRows);
      return Promise.resolve(sessionRows);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty agents
it('empty project returns empty agents array', async () => {
  mockDb([], []);
  const report = await analyzeAgentSuccessRate('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.projectSuccessRate).toBe(0);
  expect(report.mostReliableAgent).toBeNull();
  expect(report.mostFragileAgent).toBeNull();
  expect(report.criticalAgentsCount).toBe(0);
});

// Test 2: 100% success rate = 'reliable' tier
it('agent with 100% success rate gets reliable tier', () => {
  const sessions: SessionRow[] = [
    makeSession('AgentA', 'completed'),
    makeSession('AgentA', 'completed'),
    makeSession('AgentA', 'completed'),
  ];
  const profiles = buildSuccessRateProfiles(sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  expect(agentA.successRate).toBe(100);
  expect(agentA.reliabilityTier).toBe('reliable');
});

// Test 3: < 50% = 'critical' tier
it('agent with less than 50% success rate gets critical tier', () => {
  expect(computeReliabilityTier(49)).toBe('critical');
  expect(computeReliabilityTier(0)).toBe('critical');
});

// Test 4: mostReliableAgent only set when >=3 sessions
it('mostReliableAgent only set for agents with >= 3 sessions', async () => {
  mockDb(
    [{ id: 't1' }],
    [
      makeSession('AgentA', 'completed'),
      makeSession('AgentA', 'completed'),
      // only 2 sessions — disqualified
    ],
  );
  const report = await analyzeAgentSuccessRate('proj-1');
  expect(report.mostReliableAgent).toBeNull();
});

// Test 5: successRate formula correct
it('successRate formula is correct', () => {
  const sessions: SessionRow[] = [
    makeSession('AgentA', 'completed'),
    makeSession('AgentA', 'completed'),
    makeSession('AgentA', 'failed'),
    makeSession('AgentA', 'aborted'),
  ];
  const profiles = buildSuccessRateProfiles(sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  // 2 completed / 4 total = 50%
  expect(agentA.successRate).toBe(50);
  expect(agentA.successfulSessions).toBe(2);
  expect(agentA.failedSessions).toBe(1);
  expect(agentA.abandonedSessions).toBe(1);
});

// Test 6: criticalAgentsCount correct
it('criticalAgentsCount counts agents with critical tier', async () => {
  mockDb(
    [{ id: 't1' }],
    [
      makeSession('AgentA', 'completed'),
      makeSession('AgentA', 'completed'),
      makeSession('AgentA', 'failed'),
      makeSession('AgentA', 'failed'),
      makeSession('AgentA', 'failed'),
      makeSession('AgentB', 'completed'),
      makeSession('AgentB', 'completed'),
    ],
  );
  const report = await analyzeAgentSuccessRate('proj-2');
  // AgentA: 2/5 = 40% → critical; AgentB: 2/2 = 100% → reliable
  expect(report.criticalAgentsCount).toBe(1);
});

// Test 7: avgDurationMinutes calculation
it('avgDurationMinutes is calculated from startedAt to completedAt', () => {
  const start = new Date('2026-01-01T10:00:00Z');
  const end = new Date('2026-01-01T10:30:00Z');
  const sessions: SessionRow[] = [
    makeSession('AgentA', 'completed', start, end),
    makeSession('AgentA', 'completed', start, new Date('2026-01-01T10:10:00Z')),
    makeSession('AgentA', 'failed', null, null),
  ];
  const profiles = buildSuccessRateProfiles(sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  // (30 + 10) / 2 = 20 min
  expect(agentA.avgDurationMinutes).toBe(20);
});

// Test 8: AI summary fallback
it('uses fallback aiSummary when AI call fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('AI error'));
  mockDb([], []);
  const report = await analyzeAgentSuccessRate('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
