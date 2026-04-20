import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreAgentOutputQuality } from './agent-output-quality-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}

// Returns mocked db where:
// call 0 → ticketRows, calls 1/2/3 → noteRows/gateRows/sessionRows (via Promise.all)
function mockDb(
  ticketRows: unknown[],
  noteRows: unknown[] = [],
  gateRows: unknown[] = [],
  sessionRows: unknown[] = [],
) {
  let callCount = 0;
  const datasets = [ticketRows, noteRows, gateRows, sessionRows];
  (db as any).select.mockImplementation(() => {
    const data = datasets[callCount] ?? [];
    callCount++;
    return makeSelectChain(data);
  });
}

function makeTicket(id: string, persona: string, status: string) {
  return { id, assignedPersona: persona, status };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('scoreAgentOutputQuality', () => {
  it('returns empty array for empty project', async () => {
    mockDb([]);
    const result = await scoreAgentOutputQuality('proj-1');
    expect(result).toHaveLength(0);
  });

  it('returns excellent tier for agent with all-perfect metrics', async () => {
    mockDb(
      [makeTicket('t1', 'Alice', 'done'), makeTicket('t2', 'Alice', 'done')],
      [{ handoffFrom: 'Alice', handoffTo: 'Bob', ticketId: 't1' }],
      [],
      [{ personaType: 'Alice', status: 'completed', ticketId: 't1' }],
    );
    const result = await scoreAgentOutputQuality('proj-1');
    expect(result).toHaveLength(1);
    expect(result[0].qualityTier).toBe('excellent');
    expect(result[0].ticketCompletionRate).toBe(100);
    expect(result[0].sessionSuccessRate).toBe(100);
  });

  it('returns poor tier for agent with all-zero metrics', async () => {
    mockDb(
      [makeTicket('t1', 'Bob', 'backlog'), makeTicket('t2', 'Bob', 'in_progress')],
      [{ handoffFrom: 'Bob', handoffTo: 'Alice', ticketId: 't1' }],
      [],
      [{ personaType: 'Bob', status: 'failed', ticketId: 't1' }, { personaType: 'Bob', status: 'failed', ticketId: 't2' }],
    );
    const result = await scoreAgentOutputQuality('proj-1');
    expect(result).toHaveLength(1);
    expect(result[0].qualityTier).toBe('poor');
    expect(result[0].ticketCompletionRate).toBe(0);
    expect(result[0].sessionSuccessRate).toBe(0);
  });

  it('returns multiple agents with correct tiers sorted desc by score', async () => {
    mockDb(
      [
        makeTicket('t1', 'Alice', 'done'),
        makeTicket('t2', 'Alice', 'done'),
        makeTicket('t3', 'Bob', 'backlog'),
        makeTicket('t4', 'Bob', 'backlog'),
      ],
      [],
      [],
      [],
    );
    const result = await scoreAgentOutputQuality('proj-1');
    expect(result).toHaveLength(2);
    expect(result[0].personaId).toBe('Alice');
    expect(result[0].overallQualityScore).toBeGreaterThan(result[1].overallQualityScore);
    expect(result[1].personaId).toBe('Bob');
  });

  it('calculates rework rate correctly', async () => {
    // 1 of 2 done tickets has rejected gate → reworkRate = 50%
    mockDb(
      [makeTicket('t1', 'Alice', 'done'), makeTicket('t2', 'Alice', 'done')],
      [],
      [{ ticketId: 't1', result: 'rejected' }],
      [],
    );
    const result = await scoreAgentOutputQuality('proj-1');
    expect(result[0].reworkRate).toBe(50);
  });

  it('calculates handoff acceptance rate correctly', async () => {
    // 2 outgoing handoffs; 1 ticket in qa (accepted), 1 ticket in backlog (not accepted)
    mockDb(
      [makeTicket('t1', 'Alice', 'qa'), makeTicket('t2', 'Alice', 'in_progress')],
      [
        { handoffFrom: 'Alice', handoffTo: 'Bob', ticketId: 't1' },
        { handoffFrom: 'Alice', handoffTo: 'Bob', ticketId: 't2' },
      ],
      [],
      [],
    );
    const result = await scoreAgentOutputQuality('proj-1');
    expect(result[0].handoffAcceptanceRate).toBe(50);
  });

  it('applies correct weights to overall score', async () => {
    // completion=100, acceptance=100, rework=0, session=100
    // score = 100*0.35 + 100*0.30 + 100*0.20 + 100*0.15 = 100
    mockDb(
      [makeTicket('t1', 'Alice', 'done')],
      [],
      [],
      [{ personaType: 'Alice', status: 'completed', ticketId: 't1' }],
    );
    const result = await scoreAgentOutputQuality('proj-1');
    expect(result[0].overallQualityScore).toBe(100);
  });

  it('assigns correct tiers at boundary values', async () => {
    // Test that tier thresholds are >=80, >=60, >=40, <40
    // poor scenario: 0% completion, 0% handoff acceptance, 0% sessions → score = 0*0.35 + 0*0.30 + 100*0.20 + 0*0.15 = 20
    mockDb(
      [makeTicket('t1', 'Bob', 'backlog'), makeTicket('t2', 'Bob', 'in_progress')],
      [
        { handoffFrom: 'Bob', handoffTo: 'Alice', ticketId: 't1' },
        { handoffFrom: 'Bob', handoffTo: 'Alice', ticketId: 't2' },
      ],
      [],
      [{ personaType: 'Bob', status: 'failed', ticketId: 't1' }, { personaType: 'Bob', status: 'failed', ticketId: 't2' }],
    );
    const poor = await scoreAgentOutputQuality('proj-1');
    expect(poor[0].qualityTier).toBe('poor');
    expect(poor[0].overallQualityScore).toBeLessThan(40);

    vi.clearAllMocks();

    // excellent scenario: 100% everything
    mockDb(
      [makeTicket('t2', 'Alice', 'done')],
      [],
      [],
      [{ personaType: 'Alice', status: 'completed', ticketId: 't2' }],
    );
    const excellent = await scoreAgentOutputQuality('proj-1');
    expect(excellent[0].qualityTier).toBe('excellent');
    expect(excellent[0].overallQualityScore).toBeGreaterThanOrEqual(80);
  });
});
