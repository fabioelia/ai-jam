import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeKnowledgeGaps,
  analyzeAgentKnowledgeGaps,
  detectDomain,
  computeKnowledgeScore,
  getGapSeverity,
  getProficiencyTier,
} from './agent-knowledge-gap-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'Critical priority has multiple unassigned tickets; assign agents immediately.' }],
      }),
    },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(data),
  };
}

function mockDb(ticketData: unknown[]) {
  const dbMock = db as unknown as { select: ReturnType<typeof vi.fn> };
  dbMock.select.mockImplementation(() => makeSelectChain(ticketData));
}

function makeTicket(
  id: string,
  assignedPersona: string | null,
  status: string,
  priority = 'medium',
  storyPoints: number | null = null,
) {
  return {
    id,
    title: `Ticket ${id}`,
    assignedPersona,
    status,
    priority,
    storyPoints,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeKnowledgeGaps', () => {
  it('returns gaps: [] when no open tickets', async () => {
    mockDb([
      makeTicket('t1', null, 'done', 'critical'),
      makeTicket('t2', 'alice', 'done', 'high'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    expect(result.gaps).toHaveLength(0);
    expect(result.topGap).toBeNull();
  });

  it('computes unassignedCount correctly (null assignedPersona in open tickets)', async () => {
    mockDb([
      makeTicket('t1', null, 'backlog', 'medium'),
      makeTicket('t2', null, 'in_progress', 'medium'),
      makeTicket('t3', 'alice', 'backlog', 'medium'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    const gap = result.gaps.find((g) => g.priority === 'medium');
    expect(gap).toBeDefined();
    expect(gap!.unassignedCount).toBe(2);
    expect(gap!.openTickets).toBe(3);
  });

  it('sets gapSeverity = critical when unassignedCount >= 3', async () => {
    mockDb([
      makeTicket('t1', null, 'backlog', 'high'),
      makeTicket('t2', null, 'backlog', 'high'),
      makeTicket('t3', null, 'in_progress', 'high'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    const gap = result.gaps.find((g) => g.priority === 'high');
    expect(gap).toBeDefined();
    expect(gap!.gapSeverity).toBe('critical');
  });

  it('sets gapSeverity = critical when agentCount === 0 and demand > 0', async () => {
    mockDb([
      makeTicket('t1', null, 'backlog', 'critical'),
      makeTicket('t2', null, 'in_progress', 'critical'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    const gap = result.gaps.find((g) => g.priority === 'critical');
    expect(gap).toBeDefined();
    expect(gap!.gapSeverity).toBe('critical');
    expect(gap!.assignedAgents).toHaveLength(0);
  });

  it('sets gapSeverity = moderate when unassignedCount 1-2', async () => {
    mockDb([
      makeTicket('t1', null, 'backlog', 'low'),
      makeTicket('t2', 'alice', 'in_progress', 'low'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    const gap = result.gaps.find((g) => g.priority === 'low');
    expect(gap).toBeDefined();
    expect(gap!.gapSeverity).toBe('moderate');
  });

  it('sets gapSeverity = none when all open tickets assigned', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'backlog', 'medium'),
      makeTicket('t2', 'bob', 'in_progress', 'medium'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    const gap = result.gaps.find((g) => g.priority === 'medium');
    expect(gap).toBeDefined();
    expect(gap!.gapSeverity).toBe('none');
    expect(gap!.unassignedCount).toBe(0);
  });

  it('sets topGap to priority with critical severity (prefer critical over moderate)', async () => {
    mockDb([
      // critical priority: 3 unassigned → critical severity
      makeTicket('t1', null, 'backlog', 'critical'),
      makeTicket('t2', null, 'backlog', 'critical'),
      makeTicket('t3', null, 'backlog', 'critical'),
      // high priority: 1 unassigned → moderate severity
      makeTicket('t4', null, 'backlog', 'high'),
      makeTicket('t5', 'alice', 'backlog', 'high'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    expect(result.topGap).toBe('critical');
  });

  it('falls back to heuristic insight on AI error', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as unknown as ReturnType<typeof vi.fn>;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI unavailable')),
      },
    }));
    mockDb([
      makeTicket('t1', null, 'backlog', 'high'),
    ]);
    const result = await analyzeKnowledgeGaps('proj-1');
    expect(result.insight).toBe('Analysis based on current ticket assignment distribution');
  });
});

// FEAT-114: analyzeAgentKnowledgeGaps tests
describe('analyzeAgentKnowledgeGaps', () => {
  it('returns report with correct projectId and generatedAt', () => {
    const result = analyzeAgentKnowledgeGaps('proj-xyz', []);
    expect(result.projectId).toBe('proj-xyz');
    expect(result.generatedAt).toBeTruthy();
    expect(new Date(result.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it('correctly detects domain from keywords in session title', () => {
    const sessions = [
      { agentId: 'alice', title: 'Fix database migration issue', status: 'completed' },
      { agentId: 'alice', title: 'Update React component styles', status: 'completed' },
    ];
    const result = analyzeAgentKnowledgeGaps('proj-1', sessions);
    const domains = result.agents[0].domains.map((d) => d.domain);
    expect(domains).toContain('backend');
    expect(domains).toContain('frontend');
  });

  it('computes high knowledgeScore for high success + low retries + low escalation', () => {
    const score = computeKnowledgeScore(100, 0, 0);
    expect(score).toBeGreaterThanOrEqual(90);
  });

  it('computes low knowledgeScore (capped at 0) for low success + high retries + high escalation', () => {
    const score = computeKnowledgeScore(0, 10, 100);
    expect(score).toBe(0);
  });

  it('gapSeverity: 80→none, 60→minor, 40→moderate, 20→critical', () => {
    expect(getGapSeverity(80)).toBe('none');
    expect(getGapSeverity(60)).toBe('minor');
    expect(getGapSeverity(40)).toBe('moderate');
    expect(getGapSeverity(20)).toBe('critical');
  });

  it('proficiencyTier: specialist(80), generalist(60), developing(40), struggling(20)', () => {
    expect(getProficiencyTier(80)).toBe('specialist');
    expect(getProficiencyTier(60)).toBe('generalist');
    expect(getProficiencyTier(40)).toBe('developing');
    expect(getProficiencyTier(20)).toBe('struggling');
  });

  it('summary.criticalGapCount is correct', () => {
    const sessions = [
      { agentId: 'alice', title: 'api fix', status: 'failed', retries: 5, escalated: true },
    ];
    const result = analyzeAgentKnowledgeGaps('proj-1', sessions);
    expect(result.summary.criticalGapCount).toBeGreaterThanOrEqual(1);
  });

  it('summary.mostStruggling is the agent with lowest avgDomainScore', () => {
    const sessions = [
      { agentId: 'good-agent', title: 'api work', status: 'completed', retries: 0, escalated: false },
      { agentId: 'bad-agent', title: 'api work', status: 'failed', retries: 8, escalated: true },
    ];
    const result = analyzeAgentKnowledgeGaps('proj-1', sessions);
    expect(result.summary.mostStruggling).toBe('bad-agent');
  });
});
