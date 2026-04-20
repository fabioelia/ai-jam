import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentCognitiveLoad,
  buildCognitiveLoadMetrics,
  computeCognitiveLoadScore,
  computeLoadTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-cognitive-load-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: 'Summary. Rec1. Rec2.' }],
  });
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

const BASE_TIME = new Date('2026-04-20T10:00:00Z').getTime();

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

type TicketRow = {
  id: string;
  title: string;
  assignedPersona: string | null;
  status: string;
  createdAt: Date;
};

function makeSession(
  id: string,
  personaType: string,
  status: string,
  startOffsetMs: number,
  durationMs = 30 * 60000,
): SessionRow {
  const startedAt = new Date(BASE_TIME + startOffsetMs);
  const completedAt =
    status !== 'pending' ? new Date(BASE_TIME + startOffsetMs + durationMs) : null;
  return { id, personaType, status, startedAt, completedAt };
}

function makeTicket(
  id: string,
  assignedPersona: string | null,
  status: string,
  title = 'A ticket',
  createdAtOffset = 0,
): TicketRow {
  return {
    id,
    title,
    assignedPersona,
    status,
    createdAt: new Date(BASE_TIME + createdAtOffset),
  };
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

// Test 1: Returns correct report shape for project with 2+ agents
it('returns correct report shape for project with 2+ agents', async () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'in_progress', 'Build feature X'),
    makeTicket('t2', 'AgentB', 'in_progress', 'Fix bug Y'),
  ];
  const sessions: SessionRow[] = [
    makeSession('s1', 'AgentA', 'completed', 0),
    makeSession('s2', 'AgentA', 'completed', 60 * 60000),
    makeSession('s3', 'AgentB', 'completed', 30 * 60000),
  ];
  mockDb(tickets, sessions);

  const report = await analyzeAgentCognitiveLoad('proj-1');

  expect(report).toHaveProperty('projectId', 'proj-1');
  expect(report).toHaveProperty('agents');
  expect(Array.isArray(report.agents)).toBe(true);
  expect(report.agents.length).toBe(2);
  expect(report).toHaveProperty('mostOverloadedAgent');
  expect(report).toHaveProperty('leastLoadedAgent');
  expect(report).toHaveProperty('avgCognitiveLoadScore');
  expect(report).toHaveProperty('aiSummary');
  expect(report).toHaveProperty('aiRecommendations');
  expect(Array.isArray(report.aiRecommendations)).toBe(true);
});

// Test 2: cognitiveLoadScore formula correct (weighted average)
it('cognitiveLoadScore formula is correct weighted average', () => {
  // concurrencyScore = clamp(2/5, 0,1)*100 = 40
  // contextSwitchScore = clamp(1/4, 0,1)*100 = 25
  // tokenPressureScore = clamp(2000/4000, 0,1)*100 = 50
  // complexityScore = 0.5 * 100 = 50
  // score = round(40*0.35 + 25*0.30 + 50*0.20 + 50*0.15)
  //       = round(14 + 7.5 + 10 + 7.5) = round(39) = 39
  const score = computeCognitiveLoadScore(2, 1, 4, 2000, 0.5);
  expect(score).toBe(39);
});

// Test 3: loadTier thresholds (critical/high/moderate/low)
describe('loadTier thresholds', () => {
  it('score >= 75 is critical', () => {
    expect(computeLoadTier(75)).toBe('critical');
    expect(computeLoadTier(100)).toBe('critical');
  });
  it('score >= 55 and < 75 is high', () => {
    expect(computeLoadTier(55)).toBe('high');
    expect(computeLoadTier(74)).toBe('high');
  });
  it('score >= 35 and < 55 is moderate', () => {
    expect(computeLoadTier(35)).toBe('moderate');
    expect(computeLoadTier(54)).toBe('moderate');
  });
  it('score < 35 is low', () => {
    expect(computeLoadTier(34)).toBe('low');
    expect(computeLoadTier(0)).toBe('low');
  });
});

// Test 4: mostOverloadedAgent = highest cognitiveLoadScore
it('mostOverloadedAgent is the agent with the highest cognitiveLoadScore', async () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'HeavyAgent', 'in_progress', 'A very long title that generates high token budget proxy value'),
    makeTicket('t2', 'HeavyAgent', 'in_progress', 'Another long task title here for heavy agent workload'),
    makeTicket('t3', 'HeavyAgent', 'in_progress', 'Third task for heavy agent'),
    makeTicket('t4', 'LightAgent', 'in_progress', 'X'),
  ];
  const sessions: SessionRow[] = [
    // HeavyAgent: many sessions with in-progress tickets
    makeSession('h1', 'HeavyAgent', 'completed', 0),
    makeSession('h2', 'HeavyAgent', 'completed', 60 * 60000),
    makeSession('h3', 'HeavyAgent', 'completed', 120 * 60000),
    // LightAgent: few sessions
    makeSession('l1', 'LightAgent', 'completed', 30 * 60000),
  ];
  mockDb(tickets, sessions);

  const report = await analyzeAgentCognitiveLoad('proj-overload');
  // agents sorted by cognitiveLoadScore descending
  expect(report.mostOverloadedAgent).toBe(report.agents[0].personaId);
  expect(report.agents[0].cognitiveLoadScore).toBeGreaterThanOrEqual(
    report.agents[report.agents.length - 1].cognitiveLoadScore,
  );
});

// Test 5: leastLoadedAgent = lowest cognitiveLoadScore
it('leastLoadedAgent is the agent with the lowest cognitiveLoadScore', async () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'in_progress', 'Long task title'),
    makeTicket('t2', 'AgentB', 'in_progress', 'X'),
  ];
  const sessions: SessionRow[] = [
    makeSession('a1', 'AgentA', 'completed', 0),
    makeSession('a2', 'AgentA', 'completed', 60 * 60000),
    makeSession('b1', 'AgentB', 'completed', 90 * 60000),
  ];
  mockDb(tickets, sessions);

  const report = await analyzeAgentCognitiveLoad('proj-least');
  expect(report.leastLoadedAgent).toBe(
    report.agents[report.agents.length - 1].personaId,
  );
});

// Test 6: avgCognitiveLoadScore = mean of all agent scores
it('avgCognitiveLoadScore is the mean of all agent cognitiveLoadScores', async () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'AgentA', 'in_progress', 'Task A'),
    makeTicket('t2', 'AgentB', 'in_progress', 'Task B'),
  ];
  const sessions: SessionRow[] = [
    makeSession('a1', 'AgentA', 'completed', 0),
    makeSession('b1', 'AgentB', 'completed', 60 * 60000),
  ];
  mockDb(tickets, sessions);

  const report = await analyzeAgentCognitiveLoad('proj-avg');
  const expectedAvg = Math.round(
    report.agents.reduce((sum, a) => sum + a.cognitiveLoadScore, 0) /
      report.agents.length,
  );
  expect(report.avgCognitiveLoadScore).toBe(expectedAvg);
});

// Test 7: Empty project (no sessions) returns empty agents array, score 0
it('empty project returns empty agents array and score 0', async () => {
  mockDb([], []);

  const report = await analyzeAgentCognitiveLoad('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.mostOverloadedAgent).toBeNull();
  expect(report.leastLoadedAgent).toBeNull();
  expect(report.avgCognitiveLoadScore).toBe(0);
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});

// Test 8: Single agent returns correct metrics
it('single agent returns correct metrics', async () => {
  const tickets: TicketRow[] = [
    makeTicket('t1', 'SoloAgent', 'in_progress', 'Solo task'),
    makeTicket('t2', 'SoloAgent', 'done', 'Completed task'),
  ];
  const sessions: SessionRow[] = [
    makeSession('s1', 'SoloAgent', 'completed', 0),
    makeSession('s2', 'SoloAgent', 'completed', 60 * 60000),
    makeSession('s3', 'SoloAgent', 'completed', 120 * 60000),
  ];
  mockDb(tickets, sessions);

  const report = await analyzeAgentCognitiveLoad('proj-solo');
  expect(report.agents).toHaveLength(1);
  const agent = report.agents[0];
  expect(agent.personaId).toBe('SoloAgent');
  expect(agent.totalSessions).toBe(3);
  expect(typeof agent.cognitiveLoadScore).toBe('number');
  expect(agent.cognitiveLoadScore).toBeGreaterThanOrEqual(0);
  expect(agent.cognitiveLoadScore).toBeLessThanOrEqual(100);
  expect(['critical', 'high', 'moderate', 'low']).toContain(agent.loadTier);
  expect(report.mostOverloadedAgent).toBe('SoloAgent');
  expect(report.leastLoadedAgent).toBe('SoloAgent');
});
