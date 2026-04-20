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
import { analyzeAgentPriorityAlignment } from './agent-priority-alignment-service.js';

function makeTicket(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ticket-1',
    assignedPersona: 'AgentA',
    priority: 'medium',
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

describe('analyzeAgentPriorityAlignment', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty report when no in_progress tickets', async () => {
    mockDb([]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agentRecords).toHaveLength(0);
    expect(report.totalAgentsAnalyzed).toBe(0);
    expect(report.totalActiveTickets).toBe(0);
    expect(report.aiRecommendation).toBe(
      'Ensure agents address critical and high-priority tickets before medium and low-priority work.',
    );
  });

  it('alignmentScore = 1.0 for agent with only critical tickets', async () => {
    mockDb([
      makeTicket({ id: 't1', priority: 'critical' }),
      makeTicket({ id: 't2', priority: 'critical' }),
    ]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agentRecords[0].alignmentScore).toBeCloseTo(1.0);
  });

  it('alignmentScore = 0.5 for agent with only medium tickets', async () => {
    mockDb([makeTicket({ id: 't1', priority: 'medium' })]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agentRecords[0].alignmentScore).toBeCloseTo(0.5);
  });

  it('alignmentStatus = aligned when score >= 0.75', async () => {
    mockDb([makeTicket({ id: 't1', priority: 'critical' })]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agentRecords[0].alignmentStatus).toBe('aligned');
  });

  it('alignmentStatus = drifting when score >= 0.4 and < 0.75', async () => {
    // high=3/4=0.75 → aligned; mix high+low = (3+1)/2/4 = 0.5 → drifting
    mockDb([
      makeTicket({ id: 't1', priority: 'high' }),
      makeTicket({ id: 't2', priority: 'low' }),
    ]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agentRecords[0].alignmentScore).toBeCloseTo(0.5);
    expect(report.agentRecords[0].alignmentStatus).toBe('drifting');
  });

  it('alignmentStatus = misaligned when score < 0.4', async () => {
    mockDb([makeTicket({ id: 't1', priority: 'low' })]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agentRecords[0].alignmentScore).toBeCloseTo(0.25);
    expect(report.agentRecords[0].alignmentStatus).toBe('misaligned');
  });

  it('sorts agentRecords ascending by alignmentScore (misaligned first)', async () => {
    mockDb([
      makeTicket({ id: 't1', assignedPersona: 'GoodAgent', priority: 'critical' }),
      makeTicket({ id: 't2', assignedPersona: 'BadAgent', priority: 'low' }),
    ]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.agentRecords[0].agentPersona).toBe('BadAgent');
    expect(report.agentRecords[1].agentPersona).toBe('GoodAgent');
  });

  it('uses fallback recommendation when AI unavailable', async () => {
    mockDb([makeTicket({ id: 't1', priority: 'low' })]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    expect(report.aiRecommendation).toBe(
      'Ensure agents address critical and high-priority tickets before medium and low-priority work.',
    );
  });

  it('counts per-priority correctly in agentRecords', async () => {
    mockDb([
      makeTicket({ id: 't1', assignedPersona: 'AgentX', priority: 'critical' }),
      makeTicket({ id: 't2', assignedPersona: 'AgentX', priority: 'high' }),
      makeTicket({ id: 't3', assignedPersona: 'AgentX', priority: 'medium' }),
      makeTicket({ id: 't4', assignedPersona: 'AgentX', priority: 'low' }),
    ]);
    const report = await analyzeAgentPriorityAlignment('proj-1');
    const rec = report.agentRecords[0];
    expect(rec.criticalCount).toBe(1);
    expect(rec.highCount).toBe(1);
    expect(rec.mediumCount).toBe(1);
    expect(rec.lowCount).toBe(1);
    expect(rec.totalActiveTickets).toBe(4);
    // avg rank = (4+3+2+1)/4 = 2.5, score = 2.5/4 = 0.625
    expect(rec.alignmentScore).toBeCloseTo(0.625);
  });
});
