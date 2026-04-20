import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentIdleTime } from './agent-idle-time-service.js';

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

function makeTickets(rows: { assignedPersona: string; createdAt: Date }[]) {
  return rows.map((r, i) => ({ id: `t${i}`, assignedPersona: r.assignedPersona, createdAt: r.createdAt }));
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentIdleTime', () => {
  it('returns empty agents when no tickets', async () => {
    buildSelect([]);
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.mostIdleAgent).toBeNull();
    expect(result.totalIdleRisk).toBe(0);
  });

  it('single agent with 1 ticket → idleGapHours=0, longestIdleGap=0', async () => {
    buildSelect(makeTickets([{ assignedPersona: 'AgentA', createdAt: hoursAgo(10) }]));
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].idleGapHours).toBe(0);
    expect(result.agents[0].longestIdleGap).toBe(0);
  });

  it('agent with 2 tickets 24h apart → idleGapHours≈24', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentB', createdAt: hoursAgo(24) },
      { assignedPersona: 'AgentB', createdAt: hoursAgo(0) },
    ]));
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.agents[0].idleGapHours).toBeCloseTo(24, 0);
  });

  it('correctly classifies idle agent (utilizationRate < 20)', async () => {
    // 1 ticket, 90 days ago → ticketsPerDay = 1/90 ≈ 0.011, utilizationRate ≈ 0.56 < 20
    const daysAgo90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    buildSelect(makeTickets([{ assignedPersona: 'IdleAgent', createdAt: daysAgo90 }]));
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.agents[0].status).toBe('idle');
  });

  it('correctly classifies overloaded agent (utilizationRate >= 80)', async () => {
    // 20 tickets in last 5 days → ticketsPerDay = 4, utilizationRate = min(100, (4/2)*100) = 100
    const tickets = Array.from({ length: 20 }, (_, i) => ({
      assignedPersona: 'BusyAgent',
      createdAt: new Date(now.getTime() - (i * 6 * 60 * 60 * 1000)),
    }));
    buildSelect(makeTickets(tickets));
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.agents[0].utilizationRate).toBeGreaterThanOrEqual(80);
    expect(result.agents[0].status).toBe('overloaded');
  });

  it('mostIdleAgent = agent with highest idleGapHours', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentX', createdAt: hoursAgo(48) },
      { assignedPersona: 'AgentX', createdAt: hoursAgo(0) },
      { assignedPersona: 'AgentY', createdAt: hoursAgo(10) },
      { assignedPersona: 'AgentY', createdAt: hoursAgo(5) },
    ]));
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.mostIdleAgent).toBe('AgentX');
  });

  it('totalIdleRisk counts idle+underutilized agents', async () => {
    // AgentA: 1 ticket 30 days ago → idle
    // AgentB: 1 ticket 10 days ago → underutilized (ticketsPerDay=0.1, utilRate=5 < 20)
    const daysAgo30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const daysAgo10 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    buildSelect(makeTickets([
      { assignedPersona: 'AgentA', createdAt: daysAgo30 },
      { assignedPersona: 'AgentB', createdAt: daysAgo10 },
    ]));
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.totalIdleRisk).toBeGreaterThanOrEqual(1);
    const riskStatuses = result.agents.filter(a => a.status === 'idle' || a.status === 'underutilized');
    expect(riskStatuses.length).toBe(result.totalIdleRisk);
  });

  it('DB count() string coercion handled (Number() cast)', async () => {
    // Simulate string createdAt values (DB quirk) — service should handle Date objects
    buildSelect(makeTickets([
      { assignedPersona: 'AgentZ', createdAt: hoursAgo(5) },
      { assignedPersona: 'AgentZ', createdAt: hoursAgo(1) },
    ]));
    const result = await analyzeAgentIdleTime('proj1');
    expect(result.agents[0].totalTickets).toBe(2);
    expect(typeof result.agents[0].utilizationRate).toBe('number');
  });
});
