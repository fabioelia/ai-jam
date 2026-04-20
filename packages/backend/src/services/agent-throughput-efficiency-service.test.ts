import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentThroughputEfficiency } from './agent-throughput-efficiency-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = {
      create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

const mockSelect = db.select as ReturnType<typeof vi.fn>;

function makeTickets(rows: { assignedPersona: string; status: string; createdAt: Date; updatedAt: Date }[]) {
  return rows.map((r, i) => ({ id: `t${i}`, ...r }));
}

function buildSelect(rows: ReturnType<typeof makeTickets>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentThroughputEfficiency', () => {
  it('returns empty agents when no tickets', async () => {
    buildSelect([]);
    const result = await analyzeAgentThroughputEfficiency('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.topAgent).toBeNull();
    expect(result.bottomAgent).toBeNull();
    expect(result.avgThroughputScore).toBe(0);
  });

  it('agent with no done tickets → completedTickets=0, throughputScore=0', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentA', status: 'in_progress', createdAt: daysAgo(5), updatedAt: daysAgo(1) },
    ]));
    const result = await analyzeAgentThroughputEfficiency('proj1');
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].completedTickets).toBe(0);
    expect(result.agents[0].throughputScore).toBe(0);
  });

  it('agent with done tickets → completedTickets counts only done', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentB', status: 'done', createdAt: daysAgo(3), updatedAt: daysAgo(1) },
      { assignedPersona: 'AgentB', status: 'done', createdAt: daysAgo(5), updatedAt: daysAgo(2) },
      { assignedPersona: 'AgentB', status: 'in_progress', createdAt: daysAgo(1), updatedAt: hoursAgo(2) },
    ]));
    const result = await analyzeAgentThroughputEfficiency('proj1');
    expect(result.agents[0].completedTickets).toBe(2);
    expect(result.agents[0].totalTickets).toBe(3);
  });

  it('avgCycleTimeHours is average of done ticket cycle times', async () => {
    // 24h cycle + 48h cycle = avg 36h
    buildSelect(makeTickets([
      { assignedPersona: 'AgentC', status: 'done', createdAt: hoursAgo(24), updatedAt: hoursAgo(0) },
      { assignedPersona: 'AgentC', status: 'done', createdAt: hoursAgo(48), updatedAt: hoursAgo(0) },
    ]));
    const result = await analyzeAgentThroughputEfficiency('proj1');
    expect(result.agents[0].avgCycleTimeHours).toBeCloseTo(36, 0);
  });

  it('agents sorted by throughputScore desc, rank assigned correctly', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'LowAgent', status: 'in_progress', createdAt: daysAgo(5), updatedAt: daysAgo(1) },
      { assignedPersona: 'HighAgent', status: 'done', createdAt: daysAgo(2), updatedAt: hoursAgo(1) },
      { assignedPersona: 'HighAgent', status: 'done', createdAt: daysAgo(3), updatedAt: hoursAgo(2) },
    ]));
    const result = await analyzeAgentThroughputEfficiency('proj1');
    expect(result.agents[0].agentPersona).toBe('HighAgent');
    expect(result.agents[0].rank).toBe(1);
    expect(result.agents[1].rank).toBe(2);
  });

  it('topAgent = highest throughputScore agent', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'Alpha', status: 'done', createdAt: daysAgo(1), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Alpha', status: 'done', createdAt: daysAgo(2), updatedAt: hoursAgo(2) },
      { assignedPersona: 'Beta', status: 'in_progress', createdAt: daysAgo(10), updatedAt: daysAgo(5) },
    ]));
    const result = await analyzeAgentThroughputEfficiency('proj1');
    expect(result.topAgent).toBe('Alpha');
  });

  it('bottomAgent = lowest throughputScore agent when multiple agents', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'FastAgent', status: 'done', createdAt: daysAgo(1), updatedAt: hoursAgo(1) },
      { assignedPersona: 'FastAgent', status: 'done', createdAt: daysAgo(2), updatedAt: hoursAgo(2) },
      { assignedPersona: 'SlowAgent', status: 'in_progress', createdAt: daysAgo(30), updatedAt: daysAgo(20) },
    ]));
    const result = await analyzeAgentThroughputEfficiency('proj1');
    expect(result.bottomAgent).toBe('SlowAgent');
  });

  it('avgThroughputScore is mean of all agent scores', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'Agent1', status: 'done', createdAt: daysAgo(2), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Agent2', status: 'in_progress', createdAt: daysAgo(5), updatedAt: daysAgo(3) },
    ]));
    const result = await analyzeAgentThroughputEfficiency('proj1');
    const expected = (result.agents[0].throughputScore + result.agents[1].throughputScore) / 2;
    expect(result.avgThroughputScore).toBeCloseTo(expected, 1);
  });
});
