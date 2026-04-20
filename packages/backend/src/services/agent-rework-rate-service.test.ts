import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeReworkRate,
  buildReworkMetrics,
  qualityTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type NoteRow,
} from './agent-rework-rate-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: JSON.stringify({ summary: 'AI rework summary.', recommendations: ['Improve first-pass quality.'] }) }],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

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

function mockDb(dbTickets: { id: string; assignedPersona: string | null }[], notes: NoteRow[]) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(dbTickets);
      return Promise.resolve(notes);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty report
it('returns empty report when project has no tickets', async () => {
  mockDb([], []);
  const report = await analyzeReworkRate('proj-1');
  expect(report.agents).toHaveLength(0);
  expect(report.systemReworkRate).toBe(0);
  expect(report.lowestReworkAgent).toBeNull();
  expect(report.highestReworkAgent).toBeNull();
  expect(report.totalReworkEvents).toBe(0);
});

// Test 2: qualityTier excellent < 10%
it('assigns qualityTier excellent when rework rate < 10%', () => {
  expect(qualityTier(0)).toBe('excellent');
  expect(qualityTier(5)).toBe('excellent');
  expect(qualityTier(9.9)).toBe('excellent');
});

// Test 3: qualityTier good < 25%
it('assigns qualityTier good when rework rate is between 10% and 25%', () => {
  expect(qualityTier(10)).toBe('good');
  expect(qualityTier(20)).toBe('good');
  expect(qualityTier(24.9)).toBe('good');
});

// Test 4: qualityTier fair < 50%
it('assigns qualityTier fair when rework rate is between 25% and 50%', () => {
  expect(qualityTier(25)).toBe('fair');
  expect(qualityTier(40)).toBe('fair');
  expect(qualityTier(49.9)).toBe('fair');
});

// Test 5: qualityTier poor >= 50%
it('assigns qualityTier poor when rework rate >= 50%', () => {
  expect(qualityTier(50)).toBe('poor');
  expect(qualityTier(75)).toBe('poor');
  expect(qualityTier(100)).toBe('poor');
});

// Test 6: reworkSourceBreakdown counts correctly by source stage
it('counts rework source breakdown by stage correctly', () => {
  const notes: NoteRow[] = [
    // Rework from review stage
    makeNote('t1', 'PM', 'sending back from review', 'AgentA', 'review', 0),
    // Rework from qa stage
    makeNote('t2', 'PM', 'sending back from qa', 'AgentA', 'qa', 1000),
    // Rework from acceptance stage
    makeNote('t3', 'PM', 'sending back from acceptance', 'AgentA', 'acceptance', 2000),
    // Another rework from review
    makeNote('t4', 'PM', 'another review rework', 'AgentA', 'review', 3000),
  ];
  const { agents } = buildReworkMetrics(notes);
  const agentA = agents.find(a => a.personaId === 'AgentA');
  expect(agentA).toBeDefined();
  expect(agentA!.reworkSourceBreakdown.fromReview).toBe(2);
  expect(agentA!.reworkSourceBreakdown.fromQA).toBe(1);
  expect(agentA!.reworkSourceBreakdown.fromAcceptance).toBe(1);
});

// Test 7: lowestReworkAgent / highestReworkAgent correct
it('identifies lowestReworkAgent (best) and highestReworkAgent (worst) correctly', () => {
  const notes: NoteRow[] = [
    // AgentA: 1 rework out of 2 tickets = 50% (poor)
    makeNote('t1', 'PM', 'rework for AgentA', 'AgentA', 'review', 0),
    makeNote('t1', 'AgentA', 'working on t1', null, null, 1000),
    makeNote('t2', 'AgentA', 'working on t2 no rework', null, null, 2000),
    // AgentB: 0 rework out of 2 tickets = 0% (excellent)
    makeNote('t3', 'PM', 'handoff to AgentB', 'AgentB', null, 0),
    makeNote('t3', 'AgentB', 'working on t3', null, null, 1000),
    makeNote('t4', 'AgentB', 'working on t4', null, null, 2000),
  ];
  const { agents } = buildReworkMetrics(notes);
  // Sort by reworkRate asc: AgentB (0%) first, AgentA (higher) last
  const agentB = agents.find(a => a.personaId === 'AgentB');
  const agentA = agents.find(a => a.personaId === 'AgentA');
  expect(agentB).toBeDefined();
  expect(agentA).toBeDefined();
  expect(agentB!.reworkRate).toBeLessThan(agentA!.reworkRate);
  // lowestReworkAgent = first in sorted list = AgentB
  expect(agents[0].personaId).toBe('AgentB');
});

// Test 8: AI fallback on error
it('returns fallback aiSummary and aiRecommendations when AI call fails', async () => {
  const AISdk = (await import('@anthropic-ai/sdk')).default as ReturnType<typeof vi.fn>;
  AISdk.mockImplementationOnce(function () {
    return {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      },
    };
  });

  mockDb([{ id: 't1', assignedPersona: 'AgentA' }], [
    makeNote('t1', 'AgentA', 'working on ticket', null, null, 0),
  ]);

  const report = await analyzeReworkRate('proj-1');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
