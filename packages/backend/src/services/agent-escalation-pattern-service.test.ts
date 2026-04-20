import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeEscalationPatterns } from './agent-escalation-pattern-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"ok","aiRecommendations":["improve handoffs"]}' }] }) },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}

function mockDbSequence(ticketData: unknown[], noteData: unknown[]) {
  let callCount = 0;
  (db as any).select.mockImplementation(() => {
    const data = callCount === 0 ? ticketData : noteData;
    callCount++;
    return makeSelectChain(data);
  });
}

function makeNote(handoffFrom: string | null, handoffTo: string | null) {
  return { handoffFrom, handoffTo };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeEscalationPatterns', () => {
  it('returns empty result when no tickets', async () => {
    mockDbSequence([], []);
    const result = await analyzeEscalationPatterns('proj-1');
    expect(result.chains).toHaveLength(0);
    expect(result.hotspots).toHaveLength(0);
    expect(result.totalEscalations).toBe(0);
  });

  it('returns empty result when no handoff notes', async () => {
    mockDbSequence([{ id: 't1' }], []);
    const result = await analyzeEscalationPatterns('proj-1');
    expect(result.chains).toHaveLength(0);
    expect(result.totalEscalations).toBe(0);
    expect(result.avgChainLength).toBe(0);
  });

  it('builds chains from handoff notes', async () => {
    mockDbSequence(
      [{ id: 't1' }],
      [
        makeNote('alice', 'bob'),
        makeNote('alice', 'bob'),
        makeNote('bob', 'charlie'),
      ],
    );
    const result = await analyzeEscalationPatterns('proj-1');
    expect(result.totalEscalations).toBe(3);
    expect(result.chains).toHaveLength(2);
    const aliceBob = result.chains.find(c => c.fromAgent === 'alice' && c.toAgent === 'bob');
    expect(aliceBob?.count).toBe(2);
  });

  it('classifies hotspot severity correctly', async () => {
    // alice appears 3/3 times = 100% > 60% → critical
    mockDbSequence(
      [{ id: 't1' }],
      [makeNote('alice', 'bob'), makeNote('alice', 'charlie'), makeNote('alice', 'dave')],
    );
    const result = await analyzeEscalationPatterns('proj-1');
    const alice = result.hotspots.find(h => h.agentPersona === 'alice');
    expect(alice?.severity).toBe('critical');
  });

  it('detects circular patterns', async () => {
    mockDbSequence(
      [{ id: 't1' }],
      [makeNote('alice', 'bob'), makeNote('bob', 'alice')],
    );
    const result = await analyzeEscalationPatterns('proj-1');
    expect(result.circularPatterns.length).toBeGreaterThan(0);
  });

  it('computes avgChainLength', async () => {
    mockDbSequence(
      [{ id: 't1' }],
      [makeNote('alice', 'bob'), makeNote('alice', 'bob'), makeNote('bob', 'charlie')],
    );
    const result = await analyzeEscalationPatterns('proj-1');
    // chains: alice→bob(2), bob→charlie(1) → avg = (2+1)/2 = 1.5
    expect(result.avgChainLength).toBe(1.5);
  });

  it('sorts chains by count desc', async () => {
    mockDbSequence(
      [{ id: 't1' }],
      [
        makeNote('x', 'y'),
        makeNote('a', 'b'),
        makeNote('a', 'b'),
        makeNote('a', 'b'),
      ],
    );
    const result = await analyzeEscalationPatterns('proj-1');
    expect(result.chains[0].fromAgent).toBe('a');
    expect(result.chains[0].count).toBe(3);
  });

  it('falls back gracefully when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
    }));
    mockDbSequence([{ id: 't1' }], [makeNote('a', 'b')]);
    const result = await analyzeEscalationPatterns('proj-1');
    expect(result.aiSummary).toBe('Review escalation patterns to identify bottlenecks and improve agent handoff processes.');
  });
});
