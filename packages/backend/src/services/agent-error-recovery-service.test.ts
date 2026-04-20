import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentErrorRecovery,
  buildRecoveryProfiles,
  computeResilienceScore,
  computeResilienceTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type TicketRow,
  type NoteRow,
  type SessionRow,
} from './agent-error-recovery-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'AI recovery summary.',
        recommendations: ['Improve error handling.'],
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

function makeTicket(
  id: string,
  assignedPersona: string,
  status: string,
  blockedBy: string | null = null,
  createdAt = new Date('2026-01-01T00:00:00Z'),
  updatedAt = new Date('2026-01-02T00:00:00Z'),
): TicketRow {
  return { id, assignedPersona, status, blockedBy, createdAt, updatedAt };
}

function makeNote(
  ticketId: string,
  handoffFrom: string | null,
  handoffTo: string | null,
  createdAt = new Date('2026-01-01T12:00:00Z'),
): NoteRow {
  return { ticketId, handoffFrom, handoffTo, createdAt };
}

function makeSession(
  ticketId: string,
  personaType: string,
  startedAt = new Date('2026-01-01T01:00:00Z'),
): SessionRow {
  return { ticketId, personaType, startedAt };
}

function mockDb(tickets: TicketRow[], notes: NoteRow[], sessions: SessionRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      if (callCount === 2) return Promise.resolve(notes);
      return Promise.resolve(sessions);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: resilienceScore formula — base + bonus/penalty
it('computeResilienceScore applies formula correctly', () => {
  // 80% recovery, <2h recovery time (+10), 0 failed handoffs, 1 retry (+5) → 80+10+5=95
  expect(computeResilienceScore(80, 1, 0, 1)).toBe(95);
  // 50% recovery, 5h recovery (no +10), 2 failed handoffs (-10), 0 retries → 50-10=40
  expect(computeResilienceScore(50, 5, 2, 0)).toBe(40);
  // 0%, 0h (+10), 7 failed handoffs (-30 capped), 0 retries → 0+10-30=-20 → clamped 0
  expect(computeResilienceScore(0, 0, 7, 0)).toBe(0);
  // 100%, <2h (+10), 0 failed, 1 retry (+5) → 115 → clamped 100
  expect(computeResilienceScore(100, 1, 0, 1)).toBe(100);
});

// Test 2: resilienceTier thresholds
it('computeResilienceTier assigns correct tiers', () => {
  expect(computeResilienceTier(80)).toBe('resilient');
  expect(computeResilienceTier(100)).toBe('resilient');
  expect(computeResilienceTier(60)).toBe('adaptive');
  expect(computeResilienceTier(79)).toBe('adaptive');
  expect(computeResilienceTier(40)).toBe('fragile');
  expect(computeResilienceTier(59)).toBe('fragile');
  expect(computeResilienceTier(39)).toBe('critical');
  expect(computeResilienceTier(0)).toBe('critical');
});

// Test 3: mostResilient / mostFragile selection
it('selects mostResilientAgent and mostFragileAgent correctly', async () => {
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'done', 'other', new Date('2026-01-01'), new Date('2026-01-01T01:00:00Z')),
    makeTicket('t2', 'AgentB', 'in_progress', 'other'),
  ];
  mockDb(ticketList, [], []);
  const report = await analyzeAgentErrorRecovery('proj-1');
  expect(report.agents.length).toBe(2);
  expect(report.mostResilientAgent).toBe(report.agents[0].personaId);
  expect(report.mostFragileAgent).toBe(report.agents[1].personaId);
});

// Test 4: criticalAgentCount
it('counts critical agents correctly', async () => {
  // Agent with 0% recovery = low score → critical
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentX', 'in_progress', 'other'),
    makeTicket('t2', 'AgentX', 'in_progress', 'other'),
    makeTicket('t3', 'AgentY', 'done', 'other', new Date('2026-01-01'), new Date('2026-01-01T01:00:00Z')),
  ];
  const noteList: NoteRow[] = [
    // 3 failed handoffs from AgentX (no response)
    makeNote('t1', 'AgentX', null),
    makeNote('t1', 'AgentX', null),
    makeNote('t2', 'AgentX', null),
  ];
  mockDb(ticketList, noteList, []);
  const report = await analyzeAgentErrorRecovery('proj-1');
  const agentX = report.agents.find((a) => a.personaId === 'AgentX');
  expect(agentX).toBeDefined();
  expect(agentX!.resilienceTier).toBe('critical');
  expect(report.criticalAgentCount).toBeGreaterThanOrEqual(1);
});

// Test 5: empty project returns empty report
it('returns empty report when project has no tickets', async () => {
  mockDb([], [], []);
  const report = await analyzeAgentErrorRecovery('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.mostResilientAgent).toBeNull();
  expect(report.mostFragileAgent).toBeNull();
  expect(report.avgProjectResilienceScore).toBe(0);
  expect(report.criticalAgentCount).toBe(0);
});

// Test 6: all-zero errors case — agent with no blocked tickets
it('handles agents with no blocked tickets gracefully', () => {
  const ticketList: TicketRow[] = [makeTicket('t1', 'AgentZ', 'done', null)];
  const profiles = buildRecoveryProfiles(ticketList, [], []);
  const agent = profiles.find((p) => p.personaId === 'AgentZ');
  expect(agent).toBeDefined();
  expect(agent!.totalErrors).toBe(0);
  expect(agent!.errorRecoveryRate).toBe(0);
  expect(agent!.resilienceScore).toBeGreaterThanOrEqual(0);
});

// Test 7: retryAttempts counted within 24h
it('counts retryAttempts for sessions within 24h of blocked ticket', () => {
  const created = new Date('2026-01-01T00:00:00Z');
  const ticketList: TicketRow[] = [
    makeTicket('t1', 'AgentR', 'in_progress', 'other', created, new Date('2026-01-02')),
  ];
  const sessions: SessionRow[] = [
    makeSession('t1', 'AgentR', new Date('2026-01-01T10:00:00Z')), // within 24h
    makeSession('t1', 'AgentR', new Date('2026-01-03T00:00:00Z')), // outside 24h
  ];
  const profiles = buildRecoveryProfiles(ticketList, [], sessions);
  const agent = profiles.find((p) => p.personaId === 'AgentR');
  expect(agent!.retryAttempts).toBe(1);
});

// Test 8: AI fallback on error
it('uses fallback aiSummary and aiRecommendations when AI call fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('AI error'));
  mockDb([], [], []);
  const report = await analyzeAgentErrorRecovery('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
