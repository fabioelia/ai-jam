import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeWorkloadDistribution } from './agent-workload-distribution-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'AI summary' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

function makeTicket(assignedPersona: string | null, updatedAtHour: number) {
  const d = new Date('2025-01-01T00:00:00Z');
  d.setUTCHours(updatedAtHour);
  return { assignedPersona, updatedAt: d };
}

function makeNote(authorId: string, authorType: string, handoffFrom: string | null, createdAtHour: number) {
  const d = new Date('2025-01-01T00:00:00Z');
  d.setUTCHours(createdAtHour);
  return { authorId, authorType, handoffFrom, createdAt: d, ticketId: 'ticket-1' };
}

// Drizzle chain mock: select().from().where() or select().from().innerJoin().where()
function mockDbChain(ticketRows: object[], noteRows: object[]) {
  let callCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const rows = callCount === 0 ? ticketRows : noteRows;
    callCount++;
    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
        innerJoin: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(rows),
        }),
      }),
    };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeWorkloadDistribution', () => {
  it('empty state: no tickets returns empty report', async () => {
    mockDbChain([], []);
    const result = await analyzeWorkloadDistribution('proj-1');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.totalAgents).toBe(0);
    expect(result.summary.burstiestAgent).toBeNull();
    expect(result.summary.steadiestAgent).toBeNull();
    expect(result.aiSummary).toBe('No significant workload distribution patterns detected.');
  });

  it('single agent, single hour → burstScore = 1.0, workPattern = steady', async () => {
    mockDbChain([makeTicket('AgentA', 10), makeTicket('AgentA', 10), makeTicket('AgentA', 10)], []);
    const result = await analyzeWorkloadDistribution('proj-1');
    expect(result.agents).toHaveLength(1);
    const agent = result.agents[0];
    expect(agent.agentPersona).toBe('AgentA');
    expect(agent.burstScore).toBe(1.0);
    expect(agent.workPattern).toBe('steady');
    expect(agent.peakHour).toBe(10);
    expect(agent.quietHour).toBe(10);
    expect(agent.hourlyBuckets[10]).toBe(3);
  });

  it('burst detection: most activity in 1 hour → burstScore > 3.0 → workPattern = burst', async () => {
    // 10 in hour 5, 1 each in hours 0,1,2 → avg active = (10+1+1+1)/4 = 3.25, max = 10, burst = 3.07
    const tix = [
      ...Array(10).fill(null).map(() => makeTicket('Bursty', 5)),
      makeTicket('Bursty', 0),
      makeTicket('Bursty', 1),
      makeTicket('Bursty', 2),
    ];
    mockDbChain(tix, []);
    const result = await analyzeWorkloadDistribution('proj-1');
    const agent = result.agents[0];
    expect(agent.burstScore).toBeGreaterThan(3.0);
    expect(agent.workPattern).toBe('burst');
  });

  it('steady pattern: even spread across hours → workPattern = steady', async () => {
    // 1 ticket per each of 12 hours → all active hours have same count → burstScore = 1.0
    const tix = Array.from({ length: 12 }, (_, i) => makeTicket('Steady', i));
    mockDbChain(tix, []);
    const result = await analyzeWorkloadDistribution('proj-1');
    const agent = result.agents[0];
    expect(agent.workPattern).toBe('steady');
    expect(agent.burstScore).toBe(1.0);
  });

  it('peak hour calculation is correct', async () => {
    const tix = [
      makeTicket('AgentB', 3),
      makeTicket('AgentB', 3),
      makeTicket('AgentB', 3),
      makeTicket('AgentB', 7),
      makeTicket('AgentB', 7),
      makeTicket('AgentB', 14),
    ];
    mockDbChain(tix, []);
    const result = await analyzeWorkloadDistribution('proj-1');
    expect(result.agents[0].peakHour).toBe(3);
  });

  it('sort order: most active agent first', async () => {
    const tix = [
      makeTicket('LowAgent', 10),
      makeTicket('LowAgent', 10),
      makeTicket('HighAgent', 10),
      makeTicket('HighAgent', 10),
      makeTicket('HighAgent', 10),
      makeTicket('HighAgent', 11),
      makeTicket('HighAgent', 12),
    ];
    mockDbChain(tix, []);
    const result = await analyzeWorkloadDistribution('proj-1');
    expect(result.agents[0].agentPersona).toBe('HighAgent');
    expect(result.agents[1].agentPersona).toBe('LowAgent');
  });

  it('summary fields: burstiestAgent and steadiestAgent are correct', async () => {
    // BurstAgent: 10 in hour5, 1 in hour0 → burstScore > 1
    // SteadyAgent: 1 in each of hours 0-5 → burstScore = 1.0
    const tix = [
      ...Array(10).fill(null).map(() => makeTicket('BurstAgent', 5)),
      makeTicket('BurstAgent', 0),
      makeTicket('SteadyAgent', 0),
      makeTicket('SteadyAgent', 1),
      makeTicket('SteadyAgent', 2),
      makeTicket('SteadyAgent', 3),
      makeTicket('SteadyAgent', 4),
      makeTicket('SteadyAgent', 5),
    ];
    mockDbChain(tix, []);
    const result = await analyzeWorkloadDistribution('proj-1');
    expect(result.summary.burstiestAgent).toBe('BurstAgent');
    expect(result.summary.steadiestAgent).toBe('SteadyAgent');
  });

  it('AI summary fallback when OpenRouter unavailable', async () => {
    (Anthropic as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('Connection refused')),
      },
    }));
    mockDbChain([makeTicket('AgentX', 9)], []);
    const result = await analyzeWorkloadDistribution('proj-1');
    expect(result.aiSummary).toBe('No significant workload distribution patterns detected.');
  });
});
