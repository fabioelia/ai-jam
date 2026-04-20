import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentFeedbackIncorporation,
  buildFeedbackProfiles,
  computeIncorporationScore,
  computeIncorporationTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type TicketRow,
  type SessionRow,
} from './agent-feedback-incorporation-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'AI feedback incorporation summary.',
        recommendations: ['Improve feedback turnaround.'],
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

function makeTicket(id: string, assignedPersona: string, status: string): TicketRow {
  return { id, assignedPersona, status };
}

function makeSession(
  ticketId: string,
  personaType: string,
  retryCount: number,
  startedAt: Date | null = null,
  createdAt = new Date('2026-01-01T00:00:00Z'),
): SessionRow {
  return { ticketId, personaType, retryCount, startedAt, createdAt, completedAt: null };
}

function mockDb(ticketRows: TicketRow[], sessionRows: SessionRow[]) {
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

// Test 1: incorporationScore formula
it('computes incorporationScore correctly from components', () => {
  // Base=75, avgIter=1 (+10), repeat=2 (-5), fast=4/5>0.5 (+5) → 85
  expect(computeIncorporationScore(75, 1, 2, 4, 5)).toBe(85);
  // Base=100, avgIter=0.5 (+10), repeat=0 (-0), fast=0/10 (+0) → 110 capped 100
  expect(computeIncorporationScore(100, 0.5, 0, 0, 10)).toBe(100);
  // Base=0, avgIter=3 (+0), repeat=10 (-25 capped), fast=0/10 (+0) → -25 capped 0
  expect(computeIncorporationScore(0, 3, 10, 0, 10)).toBe(0);
  // Base=60, avgIter=2 (+0), repeat=1 (-0), fast=6/10>0.5 (+5) → 65
  expect(computeIncorporationScore(60, 2, 1, 6, 10)).toBe(65);
});

// Test 2: incorporationTier thresholds
it('assigns correct incorporation tier by score', () => {
  expect(computeIncorporationTier(80)).toBe('excellent');
  expect(computeIncorporationTier(100)).toBe('excellent');
  expect(computeIncorporationTier(60)).toBe('good');
  expect(computeIncorporationTier(79)).toBe('good');
  expect(computeIncorporationTier(40)).toBe('improving');
  expect(computeIncorporationTier(59)).toBe('improving');
  expect(computeIncorporationTier(39)).toBe('struggling');
  expect(computeIncorporationTier(0)).toBe('struggling');
});

// Test 3: repeatFeedbackCount penalty capping at -25
it('caps repeatFeedbackCount penalty at 25', () => {
  // repeat=6: penalty = min(25, (6-1)*5) = 25
  const score6 = computeIncorporationScore(50, 2, 6, 0, 10);
  // repeat=10: penalty = min(25, (10-1)*5) = min(25,45) = 25
  const score10 = computeIncorporationScore(50, 2, 10, 0, 10);
  // Both capped at same penalty
  expect(score6).toBe(score10);
  expect(score6).toBe(25); // 50 - 25 = 25
});

// Test 4: best/struggling agent selection (min 2 feedbacks received)
it('selects bestIncorporator and mostStrugglingAgent with min 2 feedbacks', async () => {
  const ticketRows: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'done'),
    makeTicket('t2', 'AgentA', 'done'),
    makeTicket('t3', 'AgentB', 'in_progress'),
    makeTicket('t4', 'AgentB', 'in_progress'),
    // AgentC has only 1 feedback — should NOT qualify
    makeTicket('t5', 'AgentC', 'done'),
  ];
  const sessionRows: SessionRow[] = [
    // AgentA: 2 feedback received, 2 incorporated → rate=100
    makeSession('t1', 'AgentA', 1),
    makeSession('t2', 'AgentA', 1),
    // AgentB: 2 feedback received, 0 incorporated (in_progress) → rate=0
    makeSession('t3', 'AgentB', 1),
    makeSession('t4', 'AgentB', 1),
    // AgentC: 1 feedback → totalFeedbackReceived=1 < 2, disqualified
    makeSession('t5', 'AgentC', 1),
  ];
  mockDb(ticketRows, sessionRows);
  const report = await analyzeAgentFeedbackIncorporation('proj-1');
  expect(report.bestIncorporator).toBe('AgentA');
  expect(report.mostStrugglingAgent).toBe('AgentB');
});

// Test 5: agentsWithRepeatFeedback count (repeatFeedbackCount > 2)
it('counts agents with repeatFeedbackCount > 2', async () => {
  const ticketRows: TicketRow[] = [
    // AgentA: 3 tickets with retryCount>1 → repeatFeedbackCount=3 > 2 ✓
    makeTicket('t1', 'AgentA', 'done'),
    makeTicket('t2', 'AgentA', 'done'),
    makeTicket('t3', 'AgentA', 'done'),
    // AgentB: 2 tickets with retryCount>1 → repeatFeedbackCount=2 ≤ 2 ✗
    makeTicket('t4', 'AgentB', 'done'),
    makeTicket('t5', 'AgentB', 'done'),
  ];
  const sessionRows: SessionRow[] = [
    makeSession('t1', 'AgentA', 2),
    makeSession('t2', 'AgentA', 2),
    makeSession('t3', 'AgentA', 2),
    makeSession('t4', 'AgentB', 2),
    makeSession('t5', 'AgentB', 2),
  ];
  mockDb(ticketRows, sessionRows);
  const report = await analyzeAgentFeedbackIncorporation('proj-2');
  expect(report.agentsWithRepeatFeedback).toBe(1); // only AgentA
});

// Test 6: empty project
it('returns empty report for project with no tickets', async () => {
  mockDb([], []);
  const report = await analyzeAgentFeedbackIncorporation('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.avgProjectIncorporationRate).toBe(0);
  expect(report.bestIncorporator).toBeNull();
  expect(report.mostStrugglingAgent).toBeNull();
  expect(report.agentsWithRepeatFeedback).toBe(0);
});

// Test 7: zero feedback received edge case (no retryCount > 0)
it('handles agent with zero feedback received without crashing', () => {
  const ticketRows: TicketRow[] = [
    makeTicket('t1', 'AgentX', 'done'),
    makeTicket('t2', 'AgentX', 'done'),
  ];
  const sessionRows: SessionRow[] = [
    // retryCount=0 → NOT in feedbackTicketIds
    makeSession('t1', 'AgentX', 0),
    makeSession('t2', 'AgentX', 0),
  ];
  const profiles = buildFeedbackProfiles(ticketRows, sessionRows);
  const agentX = profiles.find((p) => p.personaId === 'AgentX');
  expect(agentX).toBeDefined();
  expect(agentX!.totalFeedbackReceived).toBe(0);
  expect(agentX!.incorporationRate).toBe(0);
  expect(agentX!.incorporationScore).toBeGreaterThanOrEqual(0);
  expect(agentX!.incorporationScore).toBeLessThanOrEqual(100);
});

// Test 8: AI fallback when OpenRouter fails
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('AI error'));
  mockDb([], []);
  const report = await analyzeAgentFeedbackIncorporation('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
