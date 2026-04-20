import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentDecisionSpeed,
  buildSpeedProfiles,
  computeSpeedTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type NoteRow,
} from './agent-decision-speed-service.js';

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
                summary: 'AI decision speed summary.',
                recommendations: ['Reduce latency for stalled agents.'],
              }),
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';

const NOW = new Date('2026-04-20T00:00:00Z');

function makeNote(
  ticketId: string,
  authorId: string,
  content: string,
  handoffTo: string | null = null,
  handoffFrom: string | null = null,
  offsetMs = 0,
): NoteRow {
  return {
    id: `n-${Math.random().toString(36).slice(2)}`,
    ticketId,
    authorId,
    content,
    handoffFrom,
    handoffTo,
    createdAt: new Date(NOW.getTime() + offsetMs),
  };
}

type TicketRow = { id: string; assignedPersona: string | null; createdAt: Date; updatedAt: Date };

function makeTicket(id: string, assignedPersona: string | null = null, offsetMs = 0): TicketRow {
  return {
    id,
    assignedPersona,
    createdAt: new Date(NOW.getTime()),
    updatedAt: new Date(NOW.getTime() + offsetMs),
  };
}

function mockDb(tickets: TicketRow[], notes: NoteRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      return Promise.resolve(notes);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty report
it('returns empty report when project has no tickets', async () => {
  mockDb([], []);
  const report = await analyzeAgentDecisionSpeed('proj-1');
  expect(report.agents).toHaveLength(0);
  expect(report.systemAvgLatencyMs).toBe(0);
  expect(report.fastestAgent).toBeNull();
  expect(report.slowestAgent).toBeNull();
  expect(report.systemStallRate).toBe(0);
});

// Test 2: speedTier fast < 60000ms
it('assigns speedTier fast when avgHandoffLatencyMs < 60000', () => {
  expect(computeSpeedTier(0)).toBe('fast');
  expect(computeSpeedTier(30_000)).toBe('fast');
  expect(computeSpeedTier(59_999)).toBe('fast');
});

// Test 3: speedTier moderate < 300000ms
it('assigns speedTier moderate when avgHandoffLatencyMs < 300000', () => {
  expect(computeSpeedTier(60_000)).toBe('moderate');
  expect(computeSpeedTier(180_000)).toBe('moderate');
  expect(computeSpeedTier(299_999)).toBe('moderate');
});

// Test 4: speedTier slow < 1800000ms
it('assigns speedTier slow when avgHandoffLatencyMs < 1800000', () => {
  expect(computeSpeedTier(300_000)).toBe('slow');
  expect(computeSpeedTier(900_000)).toBe('slow');
  expect(computeSpeedTier(1_799_999)).toBe('slow');
});

// Test 5: speedTier stalled >= 1800000ms
it('assigns speedTier stalled when avgHandoffLatencyMs >= 1800000', () => {
  expect(computeSpeedTier(1_800_000)).toBe('stalled');
  expect(computeSpeedTier(3_600_000)).toBe('stalled');
});

// Test 6: stallRate calculation
it('computes stallRate as pct of assignments where latency > 30min', () => {
  const STALL_MS = 31 * 60 * 1000; // 31 minutes > 30 min threshold
  const FAST_MS = 5 * 60 * 1000; // 5 minutes
  const notes: NoteRow[] = [
    // Handoff 1: fast response (5 min)
    makeNote('t1', 'Owner', 'handoff to AgentA', 'AgentA', null, 0),
    makeNote('t1', 'AgentA', 'quick response', null, null, FAST_MS),
    // Handoff 2: slow response (31 min = stalled)
    makeNote('t2', 'Owner', 'handoff to AgentA', 'AgentA', null, 0),
    makeNote('t2', 'AgentA', 'slow response', null, null, STALL_MS),
  ];
  const tickets: TicketRow[] = [makeTicket('t1', 'AgentA', FAST_MS), makeTicket('t2', 'AgentA', STALL_MS)];
  const profiles = buildSpeedProfiles(notes, tickets);
  const agentA = profiles.find((p) => p.personaId === 'AgentA');
  expect(agentA).toBeDefined();
  // 1 out of 2 assignments stalled = 50%
  expect(agentA!.stallRate).toBe(50);
});

// Test 7: fastestAgent/slowestAgent by avgHandoffLatencyMs
it('identifies fastestAgent and slowestAgent by avgHandoffLatencyMs', async () => {
  const FAST_MS = 10_000; // 10 seconds
  const SLOW_MS = 600_000; // 10 minutes
  const tickets: TicketRow[] = [
    makeTicket('t1', 'FastAgent', FAST_MS),
    makeTicket('t2', 'SlowAgent', SLOW_MS),
  ];
  const notes: NoteRow[] = [
    makeNote('t1', 'Owner', 'handoff to FastAgent', 'FastAgent', null, 0),
    makeNote('t1', 'FastAgent', 'fast action', null, null, FAST_MS),
    makeNote('t2', 'Owner', 'handoff to SlowAgent', 'SlowAgent', null, 0),
    makeNote('t2', 'SlowAgent', 'slow action', null, null, SLOW_MS),
  ];
  mockDb(tickets, notes);
  const report = await analyzeAgentDecisionSpeed('proj-1');
  expect(report.fastestAgent).toBe('FastAgent');
  expect(report.slowestAgent).toBe('SlowAgent');
});

// Test 8: AI fallback on error
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI error')),
    },
  }));

  mockDb([], []);
  const report = await analyzeAgentDecisionSpeed('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
