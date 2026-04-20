import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
    },
  })),
}));

import { db } from '../db/connection.js';
import { analyzeBottlenecks } from './agent-bottleneck-analyzer-service.js';

const NOW = new Date('2026-04-20T12:00:00Z');
vi.setSystemTime(NOW);

const nowMs = NOW.getTime();

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    status: 'in_progress',
    assignedPersona: 'AgentA',
    updatedAt: new Date(nowMs - 36 * 60 * 60 * 1000).toISOString(), // 36h ago
    ...overrides,
  };
}

function mockDb(ticketList: ReturnType<typeof makeTicket>[]) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(ticketList),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('analyzeBottlenecks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty agentBottlenecks and zero stalledTickets when no tickets', async () => {
    mockDb([]);
    const report = await analyzeBottlenecks('proj-1');
    expect(report.agentBottlenecks).toHaveLength(0);
    expect(report.stalledTickets).toBe(0);
    expect(report.totalTickets).toBe(0);
  });

  it('excludes backlog and done tickets from dwell calculation', async () => {
    mockDb([
      makeTicket({ id: 't1', status: 'backlog', updatedAt: new Date(nowMs - 200 * 60 * 60 * 1000).toISOString() }),
      makeTicket({ id: 't2', status: 'done', updatedAt: new Date(nowMs - 200 * 60 * 60 * 1000).toISOString() }),
    ]);
    const report = await analyzeBottlenecks('proj-1');
    // All active stages should have ticketCount = 0
    for (const sb of report.stageBottlenecks) {
      expect(sb.ticketCount).toBe(0);
    }
    expect(report.stalledTickets).toBe(0);
  });

  it('assigns critical severity when avgDwellMs > 259_200_000 (72h)', async () => {
    const updatedAt = new Date(nowMs - 73 * 60 * 60 * 1000).toISOString(); // 73h ago
    mockDb([makeTicket({ id: 't1', status: 'review', updatedAt })]);
    const report = await analyzeBottlenecks('proj-1');
    const stage = report.stageBottlenecks.find((s) => s.stage === 'review')!;
    expect(stage.bottleneckSeverity).toBe('critical');
  });

  it('assigns moderate severity when avgDwellMs between 24h and 72h', async () => {
    const updatedAt = new Date(nowMs - 48 * 60 * 60 * 1000).toISOString(); // 48h ago
    mockDb([makeTicket({ id: 't1', status: 'qa', updatedAt })]);
    const report = await analyzeBottlenecks('proj-1');
    const stage = report.stageBottlenecks.find((s) => s.stage === 'qa')!;
    expect(stage.bottleneckSeverity).toBe('moderate');
  });

  it('assigns low severity when avgDwellMs < 86_400_000 (24h)', async () => {
    const updatedAt = new Date(nowMs - 12 * 60 * 60 * 1000).toISOString(); // 12h ago
    mockDb([makeTicket({ id: 't1', status: 'acceptance', updatedAt })]);
    const report = await analyzeBottlenecks('proj-1');
    const stage = report.stageBottlenecks.find((s) => s.stage === 'acceptance')!;
    expect(stage.bottleneckSeverity).toBe('low');
  });

  it('excludes agent with no stalled tickets from agentBottlenecks', async () => {
    // Ticket in_progress but only 12h old — not stalled (< 72h threshold)
    const updatedAt = new Date(nowMs - 12 * 60 * 60 * 1000).toISOString();
    mockDb([makeTicket({ id: 't1', assignedPersona: 'AgentA', updatedAt })]);
    const report = await analyzeBottlenecks('proj-1');
    expect(report.agentBottlenecks).toHaveLength(0);
  });

  it('caps bottleneckScore at 100', async () => {
    // All 3 tickets stalled > 72h — score would be 300% without cap
    const stalledAt = new Date(nowMs - 80 * 60 * 60 * 1000).toISOString();
    mockDb([
      makeTicket({ id: 't1', assignedPersona: 'AgentA', updatedAt: stalledAt }),
      makeTicket({ id: 't2', assignedPersona: 'AgentA', updatedAt: stalledAt }),
      makeTicket({ id: 't3', assignedPersona: 'AgentA', updatedAt: stalledAt }),
    ]);
    const report = await analyzeBottlenecks('proj-1');
    const agent = report.agentBottlenecks.find((a) => a.agentPersona === 'AgentA');
    expect(agent).toBeDefined();
    expect(agent!.bottleneckScore).toBeLessThanOrEqual(100);
  });

  it('uses fallback recommendation when AI errors', async () => {
    const stalledAt = new Date(nowMs - 80 * 60 * 60 * 1000).toISOString();
    mockDb([makeTicket({ id: 't1', assignedPersona: 'AgentA', updatedAt: stalledAt })]);
    const report = await analyzeBottlenecks('proj-1');
    const agent = report.agentBottlenecks.find((a) => a.agentPersona === 'AgentA');
    expect(agent).toBeDefined();
    expect(agent!.recommendation).toBe('Reduce concurrent ticket assignments to clear the bottleneck.');
    expect(report.aiSummary).toBe('Identify stalled tickets and redistribute workload to unblock the pipeline.');
  });
});
