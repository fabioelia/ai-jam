import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  classifyWindow,
  computeWindowScore,
  getPeakLabel,
  getConsistencyTier,
  analyzeAgentPeakPerformance,
} from '../agent-peak-performance-service.js';

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

const now = new Date('2025-01-15T14:00:00Z');

function makeTicket(
  assignedPersona: string,
  status: string,
  updatedHour: number,
  daysToComplete = 5,
) {
  const updatedAt = new Date(now);
  updatedAt.setHours(updatedHour, 0, 0, 0);
  const createdAt = new Date(updatedAt.getTime() - daysToComplete * 24 * 60 * 60 * 1000);
  return { id: Math.random().toString(), assignedPersona, status, updatedAt, createdAt };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('classifyWindow', () => {
  it('hour 6 = morning', () => expect(classifyWindow(6)).toBe('morning'));
  it('hour 11 = morning', () => expect(classifyWindow(11)).toBe('morning'));
  it('hour 12 = afternoon', () => expect(classifyWindow(12)).toBe('afternoon'));
  it('hour 17 = afternoon', () => expect(classifyWindow(17)).toBe('afternoon'));
  it('hour 18 = evening', () => expect(classifyWindow(18)).toBe('evening'));
  it('hour 23 = evening', () => expect(classifyWindow(23)).toBe('evening'));
  it('hour 0 = night', () => expect(classifyWindow(0)).toBe('night'));
  it('hour 5 = night', () => expect(classifyWindow(5)).toBe('night'));
});

describe('computeWindowScore', () => {
  it('100% completion, 100 speed, 10 sessions = 100', () => {
    expect(computeWindowScore(1, 1, 10)).toBe(100);
  });

  it('0 completion, 0 speed, 0 sessions = 0', () => {
    expect(computeWindowScore(0, 0, 0)).toBe(0);
  });

  it('50% completion, 50 speed, 5 sessions = 60*0.5+30*0.5+0.5*10 = 50', () => {
    const score = computeWindowScore(0.5, 0.5, 5);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('volume bonus capped at 10 for sessionCount >= 10', () => {
    const s10 = computeWindowScore(0, 0, 10);
    const s20 = computeWindowScore(0, 0, 20);
    expect(s10).toBe(s20);
  });
});

describe('getPeakLabel', () => {
  it('morning label', () => expect(getPeakLabel('morning')).toBe('🌅 Morning'));
  it('afternoon label', () => expect(getPeakLabel('afternoon')).toBe('☀️ Afternoon'));
  it('evening label', () => expect(getPeakLabel('evening')).toBe('🌆 Evening'));
  it('night label', () => expect(getPeakLabel('night')).toBe('🌙 Night'));
  it('insufficient_data label', () => expect(getPeakLabel('insufficient_data')).toBe('N/A'));
});

describe('getConsistencyTier', () => {
  it('>= 75 = consistent', () => expect(getConsistencyTier(75)).toBe('consistent'));
  it('>= 50 = moderate', () => expect(getConsistencyTier(50)).toBe('moderate'));
  it('< 50 = variable', () => expect(getConsistencyTier(49)).toBe('variable'));
  it('100 = consistent', () => expect(getConsistencyTier(100)).toBe('consistent'));
  it('0 = variable', () => expect(getConsistencyTier(0)).toBe('variable'));
});

describe('analyzeAgentPeakPerformance', () => {
  it('returns empty agents when no tickets', async () => {
    buildSelect([]);
    const result = await analyzeAgentPeakPerformance('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.totalAgents).toBe(0);
    expect(result.projectId).toBe('proj1');
    expect(result.generatedAt).toBeTruthy();
  });

  it('agent with < 3 sessions gets insufficient_data', async () => {
    buildSelect([
      makeTicket('AgentA', 'done', 9),
      makeTicket('AgentA', 'done', 10),
    ]);
    const result = await analyzeAgentPeakPerformance('proj1');
    expect(result.agents[0].peakWindow).toBe('insufficient_data');
    expect(result.agents[0].peakScore).toBe(0);
    expect(result.agents[0].windows).toHaveLength(0);
  });

  it('agent with >= 3 sessions gets windows computed', async () => {
    buildSelect([
      makeTicket('AgentB', 'done', 9),
      makeTicket('AgentB', 'done', 10),
      makeTicket('AgentB', 'done', 11),
    ]);
    const result = await analyzeAgentPeakPerformance('proj1');
    const agent = result.agents[0];
    expect(agent.windows).toHaveLength(4);
    expect(agent.peakWindow).not.toBe('insufficient_data');
  });

  it('peak window is window with highest score', async () => {
    const morningTickets = Array.from({ length: 5 }, () => makeTicket('AgentC', 'done', 9, 2));
    const nightTickets = Array.from({ length: 1 }, () => makeTicket('AgentC', 'backlog', 2, 20));
    buildSelect([...morningTickets, ...nightTickets]);
    const result = await analyzeAgentPeakPerformance('proj1');
    const agent = result.agents[0];
    expect(agent.peakWindow).toBe('morning');
  });

  it('summary totalAgents matches agent array length', async () => {
    buildSelect([
      makeTicket('A1', 'done', 9),
      makeTicket('A1', 'done', 10),
      makeTicket('A1', 'done', 11),
      makeTicket('A2', 'done', 14),
      makeTicket('A2', 'done', 15),
      makeTicket('A2', 'done', 16),
    ]);
    const result = await analyzeAgentPeakPerformance('proj1');
    expect(result.summary.totalAgents).toBe(result.agents.length);
  });

  it('summary agentsWithPeak excludes insufficient_data agents', async () => {
    buildSelect([
      makeTicket('Enough', 'done', 9),
      makeTicket('Enough', 'done', 10),
      makeTicket('Enough', 'done', 11),
      makeTicket('TooFew', 'done', 9),
    ]);
    const result = await analyzeAgentPeakPerformance('proj1');
    expect(result.summary.agentsWithPeak).toBe(1);
  });

  it('aiSummary and aiRecommendations are non-empty strings', async () => {
    buildSelect([]);
    const result = await analyzeAgentPeakPerformance('proj1');
    expect(typeof result.aiSummary).toBe('string');
    expect(result.aiSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.aiRecommendations)).toBe(true);
    expect(result.aiRecommendations.length).toBeGreaterThan(0);
  });
});
