import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentErrorRates } from './agent-error-rate-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"ok"}' }] }) },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}
function mockDb(data: unknown[]) {
  (db as any).select.mockImplementation(() => makeSelectChain(data));
}

const BASE_DATE = new Date('2025-01-01T00:00:00.000Z');
const AFTER_1HR = new Date('2025-01-01T02:00:00.000Z'); // 2 hrs after BASE_DATE

function makeTicket(
  id: string,
  assignedPersona: string | null,
  status: string,
  createdAt: string = BASE_DATE.toISOString(),
  updatedAt: string = BASE_DATE.toISOString(),
) {
  return { id, assignedPersona, status, createdAt, updatedAt };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentErrorRates', () => {
  it('returns empty agents when no assigned tickets', async () => {
    // The DB query uses isNotNull(assignedPersona), but in unit tests the mock
    // returns whatever we give it. We add a null-persona ticket and the service
    // must skip it via the `if (!persona) continue` guard.
    mockDb([makeTicket('t1', null, 'done')]);
    const result = await analyzeAgentErrorRates('proj-1');
    expect(result.agents).toHaveLength(0);
    expect(result.criticalCount).toBe(0);
    expect(result.avgReliabilityScore).toBe(0);
    expect(result.mostReliableAgent).toBeNull();
    expect(result.leastReliableAgent).toBeNull();
  });

  it('errorRate=0 and reliabilityScore=100 when no failed tickets', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'done'),
      makeTicket('t2', 'alice', 'in_progress'),
      makeTicket('t3', 'alice', 'backlog'),
    ]);
    const result = await analyzeAgentErrorRates('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.errorRate).toBe(0);
    expect(alice!.reliabilityScore).toBe(100);
  });

  it('computes errorRate = failedTasks / totalTasks', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'review'), // failed proxy
      makeTicket('t2', 'alice', 'review'), // failed proxy
      makeTicket('t3', 'alice', 'done'),
      makeTicket('t4', 'alice', 'done'),
    ]);
    const result = await analyzeAgentErrorRates('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.failedTasks).toBe(2);
    expect(alice!.totalTasks).toBe(4);
    expect(alice!.errorRate).toBe(0.5);
  });

  it('computes retriedTasks: in_progress tickets where updatedAt > createdAt + 1hr', async () => {
    mockDb([
      // retried: in_progress and updatedAt is 2hrs after createdAt
      makeTicket('t1', 'alice', 'in_progress', BASE_DATE.toISOString(), AFTER_1HR.toISOString()),
      // not retried: in_progress but updatedAt == createdAt
      makeTicket('t2', 'alice', 'in_progress', BASE_DATE.toISOString(), BASE_DATE.toISOString()),
      makeTicket('t3', 'alice', 'done'),
    ]);
    const result = await analyzeAgentErrorRates('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice).toBeDefined();
    expect(alice!.retriedTasks).toBe(1);
  });

  it('classifies critical when errorRate >= 0.3', async () => {
    // 3 failed out of 5 = 0.6 >= 0.3
    mockDb([
      makeTicket('t1', 'charlie', 'review'),
      makeTicket('t2', 'charlie', 'review'),
      makeTicket('t3', 'charlie', 'review'),
      makeTicket('t4', 'charlie', 'done'),
      makeTicket('t5', 'charlie', 'done'),
    ]);
    const result = await analyzeAgentErrorRates('proj-1');
    const charlie = result.agents.find(a => a.agentPersona === 'charlie');
    expect(charlie!.classification).toBe('critical');
  });

  it('classifies low when errorRate < 0.05', async () => {
    // 0 failed out of 3
    mockDb([
      makeTicket('t1', 'dave', 'done'),
      makeTicket('t2', 'dave', 'done'),
      makeTicket('t3', 'dave', 'in_progress'),
    ]);
    const result = await analyzeAgentErrorRates('proj-1');
    const dave = result.agents.find(a => a.agentPersona === 'dave');
    expect(dave!.classification).toBe('low');
  });

  it('boundary: errorRate exactly 0.15 → classification should be high', async () => {
    // 3 failed out of 20 = 0.15
    const tickets = [];
    for (let i = 0; i < 3; i++) tickets.push(makeTicket(`f${i}`, 'eve', 'review'));
    for (let i = 0; i < 17; i++) tickets.push(makeTicket(`d${i}`, 'eve', 'done'));
    mockDb(tickets);
    const result = await analyzeAgentErrorRates('proj-1');
    const eve = result.agents.find(a => a.agentPersona === 'eve');
    expect(eve).toBeDefined();
    expect(eve!.errorRate).toBe(0.15);
    expect(eve!.classification).toBe('high');
  });

  it('sorts by errorRate desc then totalTasks desc', async () => {
    mockDb([
      makeTicket('t1', 'low', 'done'),
      makeTicket('t2', 'high', 'review'),
      makeTicket('t3', 'high', 'review'),
      makeTicket('t4', 'high', 'done'),
    ]);
    const result = await analyzeAgentErrorRates('proj-1');
    expect(result.agents[0].agentPersona).toBe('high');
    expect(result.agents[1].agentPersona).toBe('low');
  });

  it('falls back gracefully when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockRejectedValue(new Error('AI unavailable')) },
    }));
    mockDb([makeTicket('t1', 'alice', 'done')]);
    const result = await analyzeAgentErrorRates('proj-1');
    expect(result.aiSummary).toBe('Review agent error patterns to identify reliability issues and improve task completion rates.');
    expect(result.agents).toHaveLength(1);
  });
});
