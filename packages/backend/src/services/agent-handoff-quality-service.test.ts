import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  scoreHandoff,
  gradeFromScore,
  analyzeHandoffQuality,
} from './agent-handoff-quality-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: 'Improvement suggestion.' }] }) };
  },
}));

import { db } from '../db/connection.js';

function makeChain(rows: unknown[]) {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = vi.fn().mockReturnValue(chain);
  chain.innerJoin = vi.fn().mockReturnValue(chain);
  chain.where = vi.fn().mockReturnValue(chain);
  chain.orderBy = vi.fn().mockReturnValue(chain);
  chain.limit = vi.fn().mockResolvedValue(rows);
  return chain;
}

function mockDb(noteRows: unknown[], _ticketRows: unknown[]) {
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(makeChain(noteRows));
}

beforeEach(() => vi.clearAllMocks());

describe('scoreHandoff', () => {
  it('empty content scores low and adds missing-context issue', () => {
    const { score, issues } = scoreHandoff('');
    expect(score).toBeLessThan(80);
    expect(issues.some((i) => i.category === 'missing-context')).toBe(true);
  });

  it('full quality content scores 100', () => {
    const content = 'Next step: implement the fix in src/routes/tickets.ts. Acceptance criteria: 1) returns 200, 2) saves to DB. Commit path: packages/backend/src/routes.';
    const { score } = scoreHandoff(content);
    expect(score).toBe(100);
  });

  it('short content (<50 chars) deducts points', () => {
    const { score } = scoreHandoff('short note');
    expect(score).toBeLessThanOrEqual(80);
  });

  it('missing acceptance criteria deducts 15 points', () => {
    const content = 'Next steps: fix the bug in src/routes.ts. Commit the fix.';
    const { score } = scoreHandoff(content);
    expect(score).toBeLessThan(100);
  });
});

describe('gradeFromScore', () => {
  it('maps score ranges to grades correctly', () => {
    expect(gradeFromScore(100)).toBe('exemplary');
    expect(gradeFromScore(80)).toBe('exemplary');
    expect(gradeFromScore(79)).toBe('proficient');
    expect(gradeFromScore(60)).toBe('proficient');
    expect(gradeFromScore(59)).toBe('adequate');
    expect(gradeFromScore(40)).toBe('adequate');
    expect(gradeFromScore(39)).toBe('deficient');
    expect(gradeFromScore(0)).toBe('deficient');
  });
});

describe('analyzeHandoffQuality', () => {
  it('returns empty report when no handoff notes', async () => {
    mockDb([], []);
    const report = await analyzeHandoffQuality('proj-1');
    expect(report.totalHandoffs).toBe(0);
    expect(report.handoffs).toHaveLength(0);
  });

  it('counts grades correctly', async () => {
    const noteRows = [
      { id: 'n1', ticketId: 't1', notes: 'Next step: fix src/api.ts. Acceptance criteria: returns 200. Path: packages/api.ts.', handoffFrom: 'AgentA', handoffTo: 'AgentB', createdAt: new Date() },
      { id: 'n2', ticketId: 't2', notes: 'short', handoffFrom: 'AgentB', handoffTo: 'AgentC', createdAt: new Date() },
    ];
    const ticketRows = [
      { id: 't1', title: 'Fix auth' },
      { id: 't2', title: 'Update UI' },
    ];
    mockDb(noteRows, ticketRows);
    const report = await analyzeHandoffQuality('proj-1');
    expect(report.totalHandoffs).toBe(2);
    expect(report.excellentCount + report.goodCount + report.needsImprovementCount + report.poorCount).toBe(2);
  });
});
