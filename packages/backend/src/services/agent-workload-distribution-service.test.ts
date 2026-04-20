import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentWorkloadDistribution,
  buildWorkloadProfiles,
  computeOverloadRisk,
  computeGiniCoefficient,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type TicketRow,
  type SessionRow,
} from './agent-workload-distribution-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'AI workload summary.',
        recommendations: ['Balance workload.'],
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

function makeTicket(id: string, assignedPersona: string | null): TicketRow {
  return { id, assignedPersona };
}

function makeSession(ticketId: string, personaType: string): SessionRow {
  return { ticketId, personaType };
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

// Test 1: empty project
it('empty project returns empty agents array', async () => {
  mockDb([], []);
  const report = await analyzeAgentWorkloadDistribution('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.totalProjectTickets).toBe(0);
  expect(report.mostLoadedAgent).toBeNull();
  expect(report.leastLoadedAgent).toBeNull();
  expect(report.workloadGiniCoefficient).toBe(0);
});

// Test 2: single agent gets 100% share
it('single agent gets 100% workload share', () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA'),
    makeTicket('t2', 'AgentA'),
    makeTicket('t3', 'AgentA'),
  ];
  const sessions: SessionRow[] = [makeSession('t1', 'AgentA')];
  const profiles = buildWorkloadProfiles(tickets, sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  expect(agentA.workloadShare).toBe(100);
});

// Test 3: overloadRisk 'critical' at >=60% share
it('overloadRisk is critical at >= 60% share', () => {
  expect(computeOverloadRisk(60)).toBe('critical');
  expect(computeOverloadRisk(75)).toBe('critical');
  expect(computeOverloadRisk(100)).toBe('critical');
});

// Test 4: overloadRisk 'low' at <25% share
it('overloadRisk is low at < 25% share', () => {
  expect(computeOverloadRisk(0)).toBe('low');
  expect(computeOverloadRisk(24)).toBe('low');
});

// Test 5: Gini coefficient (equal distribution = 0, unequal > 0)
it('Gini coefficient is 0 for equal distribution and > 0 for unequal', () => {
  // Equal distribution
  const equalGini = computeGiniCoefficient([25, 25, 25, 25]);
  expect(equalGini).toBeCloseTo(0, 1);

  // Unequal distribution
  const unequalGini = computeGiniCoefficient([80, 10, 5, 5]);
  expect(unequalGini).toBeGreaterThan(0.3);

  // Single agent
  expect(computeGiniCoefficient([100])).toBe(0);

  // Empty
  expect(computeGiniCoefficient([])).toBe(0);
});

// Test 6: mostLoadedAgent selection
it('mostLoadedAgent is agent with highest workload share', async () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA'),
    makeTicket('t2', 'AgentB'),
    makeTicket('t3', 'AgentB'),
    makeTicket('t4', 'AgentB'),
  ];
  mockDb(tickets, []);
  const report = await analyzeAgentWorkloadDistribution('proj-1');
  expect(report.mostLoadedAgent).toBe('AgentB');
});

// Test 7: leastLoadedAgent selection
it('leastLoadedAgent is agent with lowest workload share', async () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA'),
    makeTicket('t2', 'AgentB'),
    makeTicket('t3', 'AgentB'),
    makeTicket('t4', 'AgentB'),
  ];
  mockDb(tickets, []);
  const report = await analyzeAgentWorkloadDistribution('proj-2');
  expect(report.leastLoadedAgent).toBe('AgentA');
});

// Test 8: AI summary fallback
it('uses fallback aiSummary when AI call fails', async () => {
  mockCreate.mockRejectedValueOnce(new Error('AI error'));
  mockDb([], []);
  const report = await analyzeAgentWorkloadDistribution('proj-fail');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
