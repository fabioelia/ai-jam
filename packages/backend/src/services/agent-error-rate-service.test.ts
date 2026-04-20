import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentErrorRates } from './agent-error-rate-service.js';

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

const now = new Date();
const hoursAgo = (h: number) => new Date(now.getTime() - h * 60 * 60 * 1000);

function makeTickets(rows: { assignedPersona: string; status: string; createdAt: Date; updatedAt: Date }[]) {
  return rows.map((r, i) => ({ id: `t${i}`, ...r }));
}

function buildSelect(rows: ReturnType<typeof makeTickets>) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentErrorRates', () => {
  it('returns empty agents when no tickets', async () => {
    buildSelect([]);
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.totalAgents).toBe(0);
    expect(result.summary.avgErrorRate).toBe(0);
    expect(result.summary.mostReliableAgent).toBeNull();
  });

  it('basic calculation: errorRate=failed/total, retryRate=retried/total', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentA', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'AgentA', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'AgentA', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'AgentA', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
    ]));
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.agents).toHaveLength(1);
    const a = result.agents[0];
    expect(a.totalTasks).toBe(4);
    expect(a.failedTasks).toBe(2);
    expect(a.errorRate).toBeCloseTo(0.5, 2);
  });

  it('zero tasks edge case: agent with empty data returns zero rates', async () => {
    // Impossible in practice (requires isNotNull filter) but test service math
    buildSelect([]);
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.avgErrorRate).toBe(0);
  });

  it('critical classification when errorRate >= 0.3', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'Faulty', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Faulty', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Faulty', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Faulty', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Faulty', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Faulty', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Faulty', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
    ]));
    // errorRate = 3/7 ≈ 0.43 → critical
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.agents[0].severity).toBe('critical');
  });

  it('retry detection: in_progress ticket with updatedAt > createdAt + 1hr counts as retried', async () => {
    buildSelect(makeTickets([
      // retried: in_progress, updated 2h after creation
      { assignedPersona: 'AgentB', status: 'in_progress', createdAt: hoursAgo(3), updatedAt: hoursAgo(1) },
      // not retried: in_progress, updated <1hr after creation
      { assignedPersona: 'AgentB', status: 'in_progress', createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.1) },
      // done: not retried
      { assignedPersona: 'AgentB', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
    ]));
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.agents[0].retriedTasks).toBe(1);
    expect(result.agents[0].retryRate).toBeCloseTo(1 / 3, 2);
  });

  it('reliabilityScore bounded 0-100: reliabilityScore = max(0, 100 - errorRate*60 - retryRate*40)', async () => {
    // errorRate=0, retryRate=0 → score=100
    buildSelect(makeTickets([
      { assignedPersona: 'Perfect', status: 'done', createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.1) },
      { assignedPersona: 'Perfect', status: 'done', createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.1) },
    ]));
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.agents[0].reliabilityScore).toBe(100);
    expect(result.agents[0].reliabilityScore).toBeGreaterThanOrEqual(0);
    expect(result.agents[0].reliabilityScore).toBeLessThanOrEqual(100);
  });

  it('sort order: agents sorted by errorRate desc, then totalTasks desc', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'LowError', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'LowError', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'LowError', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'HighError', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'HighError', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'HighError', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
    ]));
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.agents[0].agentPersona).toBe('HighError');
    expect(result.agents[1].agentPersona).toBe('LowError');
  });

  it('empty project returns zero summary stats', async () => {
    buildSelect([]);
    const result = await analyzeAgentErrorRates('proj-empty');
    expect(result.summary.totalAgents).toBe(0);
    expect(result.summary.highRiskAgents).toBe(0);
    expect(result.summary.avgErrorRate).toBe(0);
    expect(result.aiSummary).toBeTruthy();
  });

  it('summary stats: highRiskAgents counts errorRate >= 0.15, mostReliableAgent has highest score', async () => {
    buildSelect(makeTickets([
      // Reliable: 0 failures
      { assignedPersona: 'Reliable', status: 'done', createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.1) },
      { assignedPersona: 'Reliable', status: 'done', createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.1) },
      { assignedPersona: 'Reliable', status: 'done', createdAt: hoursAgo(0.5), updatedAt: hoursAgo(0.1) },
      // Risky: 2/4 = 0.5 errorRate → high risk
      { assignedPersona: 'Risky', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Risky', status: 'cancelled', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Risky', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
      { assignedPersona: 'Risky', status: 'done', createdAt: hoursAgo(5), updatedAt: hoursAgo(1) },
    ]));
    const result = await analyzeAgentErrorRates('proj1');
    expect(result.summary.highRiskAgents).toBe(1);
    expect(result.summary.mostReliableAgent).toBe('Reliable');
    expect(result.summary.totalAgents).toBe(2);
  });
});
