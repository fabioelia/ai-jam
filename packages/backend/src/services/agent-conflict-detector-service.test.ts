import { describe, it, expect, vi, beforeEach } from 'vitest';
import { detectConflicts } from './agent-conflict-detector-service.js';

// Mock DB
vi.mock('../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
  },
}));

import { db } from '../db/connection.js';

// Mock Anthropic
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

const PROJECT_ID = 'proj-1';

function makeTicket(
  id: string,
  status: string,
  persona: string | null,
  labels: string[],
  epicId: string | null = null,
) {
  return { id, status, assignedPersona: persona, labels, epicId };
}

function mockDb(tickets: unknown[], epics: unknown[] = []) {
  let callCount = 0;
  (db.select as ReturnType<typeof vi.fn>).mockImplementation(() => {
    const chain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockImplementation(function (this: unknown) {
        callCount++;
        if (callCount === 1) return { ...chain, result: tickets };
        return { ...chain, result: epics };
      }),
      innerJoin: vi.fn().mockReturnThis(),
    };
    // Make the chain awaitable
    (chain.where as ReturnType<typeof vi.fn>).mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(tickets);
      return Promise.resolve(epics);
    });
    return chain;
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockResolvedValue({
    content: [{ type: 'text', text: '[]' }],
  });
});

// Helper that properly mocks the chained db calls
function setupDb(ticketRows: unknown[], epicRows: unknown[] = []) {
  let callIndex = 0;
  const mockWhere = vi.fn().mockImplementation(() => {
    callIndex++;
    if (callIndex === 1) return Promise.resolve(ticketRows);
    return Promise.resolve(epicRows);
  });
  const mockInArray = vi.fn().mockImplementation(() => Promise.resolve(epicRows));
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: mockWhere,
    innerJoin: vi.fn().mockReturnThis(),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);

  // Override where to handle inArray case for epics
  chain.where.mockImplementation((cond: unknown) => {
    callIndex++;
    if (callIndex === 1) return Promise.resolve(ticketRows);
    return Promise.resolve(epicRows);
  });
}

describe('detectConflicts', () => {
  it('returns empty domainConflicts when no tickets', async () => {
    setupDb([]);
    const report = await detectConflicts(PROJECT_ID);
    expect(report.domainConflicts).toEqual([]);
    expect(report.totalConflicts).toBe(0);
  });

  it('excludes single-agent domain (no conflict)', async () => {
    const rows = [
      makeTicket('t1', 'in_progress', 'AgentA', ['frontend']),
      makeTicket('t2', 'review', 'AgentA', ['frontend']),
    ];
    setupDb(rows);
    const report = await detectConflicts(PROJECT_ID);
    expect(report.domainConflicts).toHaveLength(0);
    expect(report.cleanDomains).toBe(1);
  });

  it('marks critical severity when conflictScore >= 80', async () => {
    // 3 agents: (3-1)*20=40; 3 active / 3 total * 60 = 60; total = 100 → capped
    const rows = [
      makeTicket('t1', 'in_progress', 'AgentA', ['api']),
      makeTicket('t2', 'review', 'AgentB', ['api']),
      makeTicket('t3', 'qa', 'AgentC', ['api']),
    ];
    setupDb(rows);
    const report = await detectConflicts(PROJECT_ID);
    expect(report.domainConflicts[0].severity).toBe('critical');
    expect(report.domainConflicts[0].conflictScore).toBeGreaterThanOrEqual(80);
  });

  it('marks high severity when conflictScore >= 50', async () => {
    // 2 agents: (2-1)*20=20; 2 active / 2 total * 60 = 60; total = 80 → critical
    // Need score 50-79: 2 agents (20) + partial active
    // 2 agents, 1 active / 2 total: 20 + 30 = 50 → high
    const rows = [
      makeTicket('t1', 'in_progress', 'AgentA', ['backend']),
      makeTicket('t2', 'done', 'AgentB', ['backend']),
    ];
    setupDb(rows);
    const report = await detectConflicts(PROJECT_ID);
    expect(report.domainConflicts[0].severity).toBe('high');
    expect(report.domainConflicts[0].conflictScore).toBe(50);
  });

  it('marks moderate severity when conflictScore >= 25', async () => {
    // 2 agents, 0 active / 2 total: 20 + 0 = 20 → low (< 25)
    // 2 agents, 0 active / 1 total: can't do (need 2 tickets for 2 agents)
    // Let's do: 2 agents, 1 active / 4 total: 20 + 15 = 35 → moderate
    const rows = [
      makeTicket('t1', 'in_progress', 'AgentA', ['auth']),
      makeTicket('t2', 'done', 'AgentB', ['auth']),
      makeTicket('t3', 'done', 'AgentA', ['auth']),
      makeTicket('t4', 'done', 'AgentA', ['auth']),
    ];
    setupDb(rows);
    const report = await detectConflicts(PROJECT_ID);
    expect(report.domainConflicts[0].severity).toBe('moderate');
    expect(report.domainConflicts[0].conflictScore).toBeGreaterThanOrEqual(25);
    expect(report.domainConflicts[0].conflictScore).toBeLessThan(50);
  });

  it('marks low severity when conflictScore > 0 and < 25', async () => {
    // 2 agents, 0 active / 3 total: 20 + 0 = 20 → low
    const rows = [
      makeTicket('t1', 'done', 'AgentA', ['docs']),
      makeTicket('t2', 'done', 'AgentB', ['docs']),
      makeTicket('t3', 'done', 'AgentA', ['docs']),
    ];
    setupDb(rows);
    const report = await detectConflicts(PROJECT_ID);
    expect(report.domainConflicts[0].severity).toBe('low');
    expect(report.domainConflicts[0].conflictScore).toBeGreaterThan(0);
    expect(report.domainConflicts[0].conflictScore).toBeLessThan(25);
  });

  it('sorts critical before high before moderate', async () => {
    const rows = [
      // moderate: 2 agents, 1 active / 4 = 35
      makeTicket('t1', 'in_progress', 'AgentA', ['docs']),
      makeTicket('t2', 'done', 'AgentB', ['docs']),
      makeTicket('t3', 'done', 'AgentA', ['docs']),
      makeTicket('t4', 'done', 'AgentA', ['docs']),
      // high: 2 agents, 1 active / 2 = 50
      makeTicket('t5', 'in_progress', 'AgentA', ['backend']),
      makeTicket('t6', 'done', 'AgentB', ['backend']),
      // critical: 3 agents, 3 active / 3 = 100
      makeTicket('t7', 'in_progress', 'AgentA', ['api']),
      makeTicket('t8', 'review', 'AgentB', ['api']),
      makeTicket('t9', 'qa', 'AgentC', ['api']),
    ];
    setupDb(rows);
    const report = await detectConflicts(PROJECT_ID);
    const severities = report.domainConflicts.map((c) => c.severity);
    const critIdx = severities.indexOf('critical');
    const highIdx = severities.indexOf('high');
    const modIdx = severities.indexOf('moderate');
    expect(critIdx).toBeLessThan(highIdx);
    expect(highIdx).toBeLessThan(modIdx);
  });

  it('uses fallback recommendation on AI error', async () => {
    mockCreate.mockRejectedValue(new Error('AI offline'));
    const rows = [
      makeTicket('t1', 'in_progress', 'AgentA', ['ui']),
      makeTicket('t2', 'review', 'AgentB', ['ui']),
    ];
    setupDb(rows);
    const report = await detectConflicts(PROJECT_ID);
    expect(report.domainConflicts[0].recommendation).toBe(
      'Assign a single lead agent to own this domain and reassign competing tickets.',
    );
    expect(report.aiSummary).toBe(
      'Review domain conflicts and establish clear agent ownership boundaries to reduce handoff confusion.',
    );
  });
});
