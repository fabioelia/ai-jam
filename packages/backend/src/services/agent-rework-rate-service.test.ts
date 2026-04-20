import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Mock } from 'vitest';
import {
  analyzeAgentReworkRate,
  buildReworkMetrics,
  reworkTier,
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
  const report = await analyzeAgentReworkRate('proj-1');
  expect(report.agents).toHaveLength(0);
  expect(report.summary.totalAgents).toBe(0);
  expect(report.summary.avgReworkRate).toBe(0);
  expect(report.summary.cleanAgents).toBe(0);
  expect(report.summary.problematicAgents).toEqual([]);
});

// Test 2: reworkTier clean <= 0.05
it('assigns reworkTier clean when reworkRate <= 0.05', () => {
  expect(reworkTier(0)).toBe('clean');
  expect(reworkTier(0.05)).toBe('clean');
});

// Test 3: reworkTier acceptable <= 0.15
it('assigns reworkTier acceptable when reworkRate is between 0.05 and 0.15', () => {
  expect(reworkTier(0.06)).toBe('acceptable');
  expect(reworkTier(0.15)).toBe('acceptable');
});

// Test 4: reworkTier concerning <= 0.30
it('assigns reworkTier concerning when reworkRate is between 0.15 and 0.30', () => {
  expect(reworkTier(0.16)).toBe('concerning');
  expect(reworkTier(0.30)).toBe('concerning');
});

// Test 5: reworkTier problematic > 0.30
it('assigns reworkTier problematic when reworkRate > 0.30', () => {
  expect(reworkTier(0.31)).toBe('problematic');
  expect(reworkTier(1.0)).toBe('problematic');
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
  const agentA = agents.find(a => a.agentId === 'AgentA');
  expect(agentA).toBeDefined();
  expect(agentA!.reworkSourceBreakdown.fromReview).toBe(2);
  expect(agentA!.reworkSourceBreakdown.fromQA).toBe(1);
  expect(agentA!.reworkSourceBreakdown.fromAcceptance).toBe(1);
});

// Test 7: agents sorted by reworkRate ascending
it('sorts agents by reworkRate ascending (lowest rework first)', () => {
  const notes: NoteRow[] = [
    // AgentA: 1 rework out of 2 tickets = 50%
    makeNote('t1', 'PM', 'rework for AgentA', 'AgentA', 'review', 0),
    makeNote('t1', 'AgentA', 'working on t1', null, null, 1000),
    makeNote('t2', 'AgentA', 'working on t2 no rework', null, null, 2000),
    // AgentB: 0 rework
    makeNote('t3', 'PM', 'handoff to AgentB', 'AgentB', null, 0),
    makeNote('t3', 'AgentB', 'working on t3', null, null, 1000),
    makeNote('t4', 'AgentB', 'working on t4', null, null, 2000),
  ];
  const { agents } = buildReworkMetrics(notes);
  const agentB = agents.find(a => a.agentId === 'AgentB');
  const agentA = agents.find(a => a.agentId === 'AgentA');
  expect(agentB).toBeDefined();
  expect(agentA).toBeDefined();
  expect(agentB!.reworkRate).toBeLessThan(agentA!.reworkRate);
  // lowest rework first
  expect(agents[0].agentId).toBe('AgentB');
});

// Test 8: new field names totalTasks, reworkedTasks, avgReworkCycles present
it('uses new field names: totalTasks, reworkedTasks, avgReworkCycles, reworkTier', () => {
  const notes: NoteRow[] = [
    makeNote('t1', 'AgentA', 'working on t1', null, null, 0),
    makeNote('t2', 'PM', 'rework', 'AgentA', 'review', 1000),
    makeNote('t2', 'AgentA', 'working on t2', null, null, 2000),
  ];
  const { agents } = buildReworkMetrics(notes);
  const agentA = agents.find(a => a.agentId === 'AgentA');
  expect(agentA).toBeDefined();
  expect(agentA).toHaveProperty('totalTasks');
  expect(agentA).toHaveProperty('reworkedTasks');
  expect(agentA).toHaveProperty('avgReworkCycles');
  expect(agentA).toHaveProperty('reworkTier');
  expect(agentA).toHaveProperty('agentId');
  expect(agentA).toHaveProperty('agentName');
  expect(agentA).toHaveProperty('commonReworkReasons');
});
