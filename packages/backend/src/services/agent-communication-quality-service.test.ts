import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCommunicationQuality } from './agent-communication-quality-service.js';

vi.mock('../db/connection.js', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

type HandoffRow = {
  id: string;
  ticketId: string;
  content: string;
  handoffFrom: string | null;
  handoffTo: string | null;
  createdAt: Date;
  ticketStatus: string | null;
};

let rowIdCounter = 0;
function makeHandoff(
  handoffFrom: string | null,
  handoffTo: string | null,
  content = 'short',
  ticketId = 'ticket-1',
  ticketStatus = 'in-progress',
  createdAt = new Date('2024-01-01T10:00:00Z'),
): HandoffRow {
  return {
    id: `row-${++rowIdCounter}`,
    ticketId,
    content,
    handoffFrom,
    handoffTo,
    createdAt,
    ticketStatus,
  };
}

function setupDb(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('analyzeAgentCommunicationQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rowIdCounter = 0;
  });

  it('returns empty report when no handoff ticketNotes', async () => {
    setupDb([]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    expect(report.agents).toEqual([]);
    expect(report.patterns).toEqual([]);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.bestCommunicator).toBeNull();
    expect(report.summary.worstCommunicator).toBeNull();
  });

  it('computes avgMessageLength from content field', async () => {
    setupDb([
      makeHandoff('AgentA', null, 'hello'),          // 5 chars
      makeHandoff('AgentA', null, 'hello world!!'),  // 13 chars
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentA')!;
    expect(agent.handoffsSent).toBe(2);
    expect(agent.avgMessageLength).toBe(9); // Math.round((5+13)/2)
  });

  it('computes contextRichness as percent of sent handoffs with content.length > 100', async () => {
    const long = 'x'.repeat(101);
    setupDb([
      makeHandoff('AgentB', null, 'short'),  // <=100
      makeHandoff('AgentB', null, long),     // >100
      makeHandoff('AgentB', null, long),     // >100
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentB')!;
    expect(agent.contextRichness).toBe(67); // Math.round(2/3*100)
  });

  it('computes clarificationRate: re-handoff on same ticket within 2hrs', async () => {
    const t0 = new Date('2024-01-01T10:00:00Z');
    const t1 = new Date('2024-01-01T11:00:00Z'); // 1hr later — within 2hrs
    setupDb([
      makeHandoff(null, 'AgentC', 'please do x', 'ticket-1', 'in-progress', t0), // received by AgentC
      makeHandoff('AgentC', null, 'clarifying', 'ticket-1', 'in-progress', t1),  // AgentC sends back within 2hrs
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentC')!;
    expect(agent.clarificationRate).toBe(100);
  });

  it('computes downstreamSuccessRate based on ticket reaching done status', async () => {
    setupDb([
      makeHandoff('AgentD', null, 'handoff', 'ticket-done', 'done'),
      makeHandoff('AgentD', null, 'handoff', 'ticket-wip', 'in-progress'),
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentD')!;
    expect(agent.downstreamSuccessRate).toBe(50); // 1 of 2 tickets done
  });

  it('computes qualityScore with correct weights', async () => {
    // contextRichness=100, clarificationRate=0, downstreamSuccessRate=100
    // qualityScore = 100*0.4 + (100-0)*0.3 + 100*0.3 = 40+30+30 = 100
    const long = 'x'.repeat(101);
    setupDb([
      makeHandoff('AgentE', null, long, 'ticket-1', 'done'),
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentE')!;
    expect(agent.contextRichness).toBe(100);
    expect(agent.clarificationRate).toBe(0);
    expect(agent.downstreamSuccessRate).toBe(100);
    expect(agent.qualityScore).toBe(100);
  });

  it('assigns tier thresholds: >=80 excellent, >=60 good, >=40 fair, <40 poor', async () => {
    // Craft agents with specific qualityScores by controlling contextRichness + downstreamSuccessRate
    // qualityScore = cr*0.4 + 100*0.3 + dsr*0.3  (clarificationRate=0)
    // For excellent (>=80): cr=100, dsr=100 → 100
    // For good (>=60): cr=50, dsr=50 → 50*0.4+30+50*0.3 = 20+30+15 = 65
    // For fair (>=40): cr=0, dsr=50 → 0+30+15 = 45
    // For poor (<40): cr=0, dsr=0 → 0+30+0 = 30
    const long = 'x'.repeat(101);
    setupDb([
      makeHandoff('Excellent', null, long, 'ticket-e', 'done'),
      makeHandoff('Good', null, long, 'ticket-g1', 'done'),
      makeHandoff('Good', null, long, 'ticket-g2', 'in-progress'),
      makeHandoff('Good', null, 'short', 'ticket-g3', 'done'),
      makeHandoff('Fair', null, 'short', 'ticket-f1', 'done'),
      makeHandoff('Fair', null, 'short', 'ticket-f2', 'in-progress'),
      makeHandoff('Poor', null, 'short', 'ticket-p', 'in-progress'),
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    const excellent = report.agents.find((a) => a.agentPersona === 'Excellent')!;
    const poor = report.agents.find((a) => a.agentPersona === 'Poor')!;
    expect(excellent.tier).toBe('excellent');
    expect(poor.qualityScore).toBeLessThan(40);
    expect(poor.tier).toBe('poor');
  });

  it('detects patterns when >= 2 agents match', async () => {
    // 'context-poor senders': contextRichness < 30 — use all short content
    setupDb([
      makeHandoff('Agent1', null, 'short', 'ticket-1', 'in-progress'),
      makeHandoff('Agent2', null, 'short', 'ticket-2', 'in-progress'),
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    const pattern = report.patterns.find((p) => p.pattern === 'context-poor senders');
    expect(pattern).toBeDefined();
    expect(pattern!.frequency).toBe(2);
    expect(pattern!.impact).toBe('negative');
  });

  it('returns correct summary fields', async () => {
    const long = 'x'.repeat(101);
    setupDb([
      makeHandoff('Best', null, long, 'ticket-1', 'done'),
      makeHandoff('Best', null, long, 'ticket-2', 'done'),
      makeHandoff('Worst', null, 'short', 'ticket-3', 'in-progress'),
      makeHandoff('Worst', null, 'short', 'ticket-4', 'in-progress'),
    ]);
    const report = await analyzeAgentCommunicationQuality('proj-1');
    expect(report.summary.totalAgents).toBe(2);
    expect(report.summary.bestCommunicator).toBe('Best');
    expect(report.summary.worstCommunicator).toBe('Worst');
    expect(report.summary.avgQualityScore).toBeGreaterThan(0);
    expect(typeof report.summary.excellentCount).toBe('number');
    expect(typeof report.summary.poorCount).toBe('number');
  });
});
