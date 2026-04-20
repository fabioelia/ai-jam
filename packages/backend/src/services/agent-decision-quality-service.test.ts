import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeDecisionQuality } from './agent-decision-quality-service.js';

// Mock DB
vi.mock('../db/connection.js', () => ({
  db: { select: vi.fn() },
}));

// Mock Anthropic
vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

function makeTicket(id: string, assignedPersona: string | null, status: string, createdAt: Date) {
  return { id, status, assignedPersona, createdAt };
}

const OLD_DATE = new Date(Date.now() - 72 * 60 * 60 * 1000); // 72h ago (regressed)
const NEW_DATE = new Date(Date.now() - 1 * 60 * 60 * 1000);  // 1h ago (not regressed)

function mockSelect(rows: any[]) {
  (db.select as any).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
}

describe('analyzeDecisionQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty agentQualities when no assigned tickets', async () => {
    mockSelect([makeTicket('t1', null, 'backlog', NEW_DATE)]);
    const report = await analyzeDecisionQuality('proj-1');
    expect(report.agentQualities).toEqual([]);
    expect(report.totalAgents).toBe(0);
  });

  it('agent with 0 regressions has revisionRate = 0 and qualityScore = 100', async () => {
    mockSelect([
      makeTicket('t1', 'AgentA', 'done', NEW_DATE),
      makeTicket('t2', 'AgentA', 'in_progress', NEW_DATE), // new ticket, not regression
    ]);
    const report = await analyzeDecisionQuality('proj-1');
    const agent = report.agentQualities.find((q) => q.agentPersona === 'AgentA')!;
    expect(agent.revisionRate).toBe(0);
    expect(agent.qualityScore).toBe(100);
  });

  it('gives excellent rating when qualityScore >= 80', async () => {
    // 1 regression out of 10 = 10% revision = 90 quality score
    const rows = Array.from({ length: 9 }, (_, i) =>
      makeTicket(`t${i}`, 'AgentA', 'done', NEW_DATE),
    );
    rows.push(makeTicket('t9', 'AgentA', 'in_progress', OLD_DATE));
    mockSelect(rows);
    const report = await analyzeDecisionQuality('proj-1');
    const agent = report.agentQualities[0];
    expect(agent.rating).toBe('excellent');
    expect(agent.qualityScore).toBe(90);
  });

  it('gives good rating when qualityScore >= 60 and < 80', async () => {
    // 3 regressions out of 10 = 30% revision = 70 quality
    const rows = Array.from({ length: 7 }, (_, i) =>
      makeTicket(`t${i}`, 'AgentA', 'done', NEW_DATE),
    );
    for (let i = 7; i < 10; i++) {
      rows.push(makeTicket(`t${i}`, 'AgentA', 'in_progress', OLD_DATE));
    }
    mockSelect(rows);
    const report = await analyzeDecisionQuality('proj-1');
    const agent = report.agentQualities[0];
    expect(agent.rating).toBe('good');
    expect(agent.qualityScore).toBe(70);
  });

  it('gives needs_improvement rating when qualityScore >= 40 and < 60', async () => {
    // 5 regressions out of 10 = 50% revision = 50 quality
    const rows = Array.from({ length: 5 }, (_, i) =>
      makeTicket(`t${i}`, 'AgentA', 'done', NEW_DATE),
    );
    for (let i = 5; i < 10; i++) {
      rows.push(makeTicket(`t${i}`, 'AgentA', 'in_progress', OLD_DATE));
    }
    mockSelect(rows);
    const report = await analyzeDecisionQuality('proj-1');
    const agent = report.agentQualities[0];
    expect(agent.rating).toBe('needs_improvement');
    expect(agent.qualityScore).toBe(50);
  });

  it('gives poor rating when qualityScore < 40', async () => {
    // 7 regressions out of 10 = 70% revision = 30 quality
    const rows = Array.from({ length: 3 }, (_, i) =>
      makeTicket(`t${i}`, 'AgentA', 'done', NEW_DATE),
    );
    for (let i = 3; i < 10; i++) {
      rows.push(makeTicket(`t${i}`, 'AgentA', 'in_progress', OLD_DATE));
    }
    mockSelect(rows);
    const report = await analyzeDecisionQuality('proj-1');
    const agent = report.agentQualities[0];
    expect(agent.rating).toBe('poor');
    expect(agent.qualityScore).toBe(30);
  });

  it('sort order: poor before needs_improvement before good', async () => {
    const rows = [
      // AgentA: 1/10 regression = 90 score = excellent
      ...Array.from({ length: 9 }, (_, i) => makeTicket(`a${i}`, 'AgentA', 'done', NEW_DATE)),
      makeTicket('a9', 'AgentA', 'in_progress', OLD_DATE),
      // AgentB: 5/10 regression = 50 score = needs_improvement
      ...Array.from({ length: 5 }, (_, i) => makeTicket(`b${i}`, 'AgentB', 'done', NEW_DATE)),
      ...Array.from({ length: 5 }, (_, i) => makeTicket(`b${5 + i}`, 'AgentB', 'in_progress', OLD_DATE)),
      // AgentC: 7/10 regression = 30 score = poor
      ...Array.from({ length: 3 }, (_, i) => makeTicket(`c${i}`, 'AgentC', 'done', NEW_DATE)),
      ...Array.from({ length: 7 }, (_, i) => makeTicket(`c${3 + i}`, 'AgentC', 'in_progress', OLD_DATE)),
    ];
    mockSelect(rows);
    const report = await analyzeDecisionQuality('proj-1');
    const ratings = report.agentQualities.map((q) => q.rating);
    expect(ratings[0]).toBe('poor');
    expect(ratings[1]).toBe('needs_improvement');
    expect(ratings[2]).toBe('excellent');
  });

  it('uses fallback recommendation on AI error', async () => {
    mockSelect([makeTicket('t1', 'AgentA', 'done', NEW_DATE)]);
    const report = await analyzeDecisionQuality('proj-1');
    const agent = report.agentQualities[0];
    expect(agent.recommendation).toBe(
      'Review ticket history to identify recurring quality issues and provide targeted feedback.',
    );
  });
});
