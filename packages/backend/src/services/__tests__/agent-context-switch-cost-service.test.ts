import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeSwitchCost,
  getSwitchCostTier,
  getSwitchRateLabel,
  analyzeContextSwitchCost,
} from '../agent-context-switch-cost-service.js';

vi.mock('../../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../../db/connection.js';

const mockSelect = db.select as ReturnType<typeof vi.fn>;

function buildSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

let ticketCounter = 0;
function makeTicket(
  assignedPersona: string,
  status: string,
  priority: string,
  updatedOffsetMs: number,
  durationMs = 86400000,
) {
  ticketCounter++;
  const updatedAt = new Date(Date.now() - updatedOffsetMs);
  const createdAt = new Date(updatedAt.getTime() - durationMs);
  return { id: `t${ticketCounter}`, assignedPersona, status, priority, updatedAt, createdAt };
}

beforeEach(() => {
  vi.clearAllMocks();
  ticketCounter = 0;
});

describe('computeSwitchCost', () => {
  it('zero same-category → switchCostPct = 0', () => {
    const { switchCostMs, switchCostPct } = computeSwitchCost(200000, 0);
    expect(switchCostPct).toBe(0);
    expect(switchCostMs).toBe(200000);
  });

  it('switch takes 50% longer → switchCostPct = 50', () => {
    const { switchCostPct } = computeSwitchCost(150000, 100000);
    expect(switchCostPct).toBe(50);
  });

  it('switch is faster → negative switchCostPct', () => {
    const { switchCostPct } = computeSwitchCost(50000, 100000);
    expect(switchCostPct).toBeLessThan(0);
  });

  it('equal durations → 0 cost', () => {
    const { switchCostMs, switchCostPct } = computeSwitchCost(100000, 100000);
    expect(switchCostMs).toBe(0);
    expect(switchCostPct).toBe(0);
  });
});

describe('getSwitchCostTier', () => {
  it('>= 25 = high_cost', () => expect(getSwitchCostTier(25)).toBe('high_cost'));
  it('>= 5 = moderate_cost', () => expect(getSwitchCostTier(5)).toBe('moderate_cost'));
  it('>= -10 = low_cost', () => expect(getSwitchCostTier(0)).toBe('low_cost'));
  it('< -10 = flexible', () => expect(getSwitchCostTier(-11)).toBe('flexible'));
  it('100 = high_cost', () => expect(getSwitchCostTier(100)).toBe('high_cost'));
  it('-10 = low_cost', () => expect(getSwitchCostTier(-10)).toBe('low_cost'));
});

describe('getSwitchRateLabel', () => {
  it('>= 70 = High Switching', () => expect(getSwitchRateLabel(70)).toBe('High Switching'));
  it('>= 40 = Moderate', () => expect(getSwitchRateLabel(40)).toBe('Moderate'));
  it('< 40 = Low Switching', () => expect(getSwitchRateLabel(39)).toBe('Low Switching'));
  it('100 = High Switching', () => expect(getSwitchRateLabel(100)).toBe('High Switching'));
  it('0 = Low Switching', () => expect(getSwitchRateLabel(0)).toBe('Low Switching'));
});

describe('analyzeContextSwitchCost', () => {
  it('returns empty agents when no tickets', async () => {
    buildSelect([]);
    const result = await analyzeContextSwitchCost('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.totalAgents).toBe(0);
    expect(result.projectId).toBe('proj1');
    expect(result.generatedAt).toBeTruthy();
  });

  it('agent with < 4 sessions gets insufficient_data tier', async () => {
    buildSelect([
      makeTicket('AgentA', 'done', 'high', 3000000),
      makeTicket('AgentA', 'done', 'low', 2000000),
      makeTicket('AgentA', 'done', 'medium', 1000000),
    ]);
    const result = await analyzeContextSwitchCost('proj1');
    expect(result.agents[0].tier).toBe('insufficient_data');
    expect(result.agents[0].switchCostPct).toBe(0);
  });

  it('agent with >= 4 sessions gets tier computed', async () => {
    buildSelect([
      makeTicket('AgentB', 'done', 'high', 4000000, 86400000),
      makeTicket('AgentB', 'done', 'high', 3000000, 86400000),
      makeTicket('AgentB', 'done', 'low', 2000000, 259200000),
      makeTicket('AgentB', 'done', 'high', 1000000, 86400000),
    ]);
    const result = await analyzeContextSwitchCost('proj1');
    const agent = result.agents[0];
    expect(agent.tier).not.toBe('insufficient_data');
    expect(agent.switchCount).toBeGreaterThanOrEqual(0);
  });

  it('switchRate computed correctly', async () => {
    buildSelect([
      makeTicket('AgentC', 'done', 'high', 4000000),
      makeTicket('AgentC', 'done', 'low', 3000000),
      makeTicket('AgentC', 'done', 'high', 2000000),
      makeTicket('AgentC', 'done', 'low', 1000000),
    ]);
    const result = await analyzeContextSwitchCost('proj1');
    const agent = result.agents[0];
    expect(agent.switchRate).toBeGreaterThan(0);
    expect(agent.switchCount).toBe(3);
  });

  it('summary totalAgents matches agents array', async () => {
    buildSelect([
      makeTicket('A1', 'done', 'high', 4000000),
      makeTicket('A1', 'done', 'low', 3000000),
      makeTicket('A1', 'done', 'high', 2000000),
      makeTicket('A1', 'done', 'medium', 1000000),
      makeTicket('A2', 'done', 'high', 400000),
      makeTicket('A2', 'done', 'low', 300000),
      makeTicket('A2', 'done', 'high', 200000),
      makeTicket('A2', 'done', 'medium', 100000),
    ]);
    const result = await analyzeContextSwitchCost('proj1');
    expect(result.summary.totalAgents).toBe(result.agents.length);
    expect(result.summary.totalAgents).toBe(2);
  });

  it('aiSummary and aiRecommendations non-empty', async () => {
    buildSelect([]);
    const result = await analyzeContextSwitchCost('proj1');
    expect(typeof result.aiSummary).toBe('string');
    expect(result.aiSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.aiRecommendations)).toBe(true);
    expect(result.aiRecommendations.length).toBeGreaterThan(0);
  });
});
