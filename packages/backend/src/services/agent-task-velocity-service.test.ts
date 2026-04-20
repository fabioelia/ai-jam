import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTaskVelocity } from './agent-task-velocity-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"velocity analyzed"}' }] }) },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}
function mockDb(data: unknown[]) {
  (db as any).select.mockImplementation(() => makeSelectChain(data));
}
function makeTicket(id: string, assignedPersona: string | null, status: string, cycleHours = 24) {
  const now = new Date();
  return {
    id,
    assignedPersona,
    status,
    createdAt: new Date(now.getTime() - cycleHours * 60 * 60 * 1000),
    updatedAt: now,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeAgentTaskVelocity', () => {
  it('returns empty result when no assigned tickets', async () => {
    mockDb([]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.agents).toHaveLength(0);
    expect(result.totalAgents).toBe(0);
    expect(result.fastestAgent).toBeNull();
    expect(result.slowestAgent).toBeNull();
  });

  it('computes velocityScore = max(0, round((100 - avgCycleHours/2)*10)/10)', async () => {
    // cycleHours = 24 → score = (100 - 12) * 10 / 10 = 88
    mockDb([makeTicket('t1', 'alice', 'done', 24)]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.velocityScore).toBeCloseTo(88, 0);
  });

  it('rating fast when velocityScore >= 75', async () => {
    // cycle 24h → score ~88 → fast
    mockDb([makeTicket('t1', 'alice', 'done', 24)]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.agents[0].rating).toBe('fast');
  });

  it('rating bottleneck when velocityScore < 25', async () => {
    // cycle 160h → score = max(0,(100-80)*10/10) = 20 → bottleneck
    mockDb([makeTicket('t1', 'alice', 'done', 160)]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.agents[0].rating).toBe('bottleneck');
  });

  it('sorts bottleneck before fast', async () => {
    mockDb([
      makeTicket('t1', 'fast-agent', 'done', 10),   // high score → fast
      makeTicket('t2', 'slow-agent', 'done', 200),  // low score → bottleneck
    ]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.agents[0].agentPersona).toBe('slow-agent');
    expect(result.agents[1].agentPersona).toBe('fast-agent');
  });

  it('fastestAgent is last in sorted array (fast rating)', async () => {
    mockDb([
      makeTicket('t1', 'fast', 'done', 10),
      makeTicket('t2', 'slow', 'done', 180),
    ]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.fastestAgent).toBe('fast');
    expect(result.slowestAgent).toBe('slow');
  });

  it('bottleneckAgents count correct', async () => {
    mockDb([
      makeTicket('t1', 'a', 'done', 200), // bottleneck
      makeTicket('t2', 'b', 'done', 200), // bottleneck
      makeTicket('t3', 'c', 'done', 10),  // fast
    ]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.bottleneckAgents).toBe(2);
  });

  it('null fastestAgent when no agents', async () => {
    mockDb([]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.fastestAgent).toBeNull();
    expect(result.slowestAgent).toBeNull();
  });

  it('falls back gracefully when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
    }));
    mockDb([makeTicket('t1', 'alice', 'done', 24)]);
    const result = await analyzeAgentTaskVelocity('proj-1');
    expect(result.aiSummary).toBe('Review agent task velocity to identify bottlenecks and optimize ticket completion times.');
  });
});
