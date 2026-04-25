import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeSuccessRate,
  getReliabilityTier,
  getReliabilityLabel,
  formatSuccessRate,
  analyzeHandoffSuccessRate,
} from '../agent-handoff-success-rate-service.js';

vi.mock('../../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../../db/connection.js';

const mockSelect = db.select as ReturnType<typeof vi.fn>;

function buildSelect(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  mockSelect.mockReturnValue(chain);
  return chain;
}

beforeEach(() => {
  vi.clearAllMocks();
});

function makeSession(
  personaType: string,
  status: string,
  startedAt: Date | null = null,
  completedAt: Date | null = null,
) {
  return { personaType, status, startedAt, completedAt };
}

// --- computeSuccessRate ---
describe('computeSuccessRate', () => {
  it('returns 0 when total is 0', () => {
    expect(computeSuccessRate(0, 0)).toBe(0);
  });

  it('returns 1 when all sessions completed', () => {
    expect(computeSuccessRate(5, 5)).toBe(1);
  });

  it('returns correct 3-decimal float', () => {
    expect(computeSuccessRate(2, 3)).toBeCloseTo(0.667, 3);
  });

  it('returns 0 when completed is 0', () => {
    expect(computeSuccessRate(0, 10)).toBe(0);
  });
});

// --- getReliabilityTier ---
describe('getReliabilityTier', () => {
  it('returns insufficient_data for < 3 sessions', () => {
    expect(getReliabilityTier(1, 2)).toBe('insufficient_data');
    expect(getReliabilityTier(1, 0)).toBe('insufficient_data');
  });

  it('returns high for successRate >= 0.85', () => {
    expect(getReliabilityTier(0.85, 5)).toBe('high');
    expect(getReliabilityTier(1, 5)).toBe('high');
  });

  it('returns moderate for successRate >= 0.6 and < 0.85', () => {
    expect(getReliabilityTier(0.6, 5)).toBe('moderate');
    expect(getReliabilityTier(0.84, 5)).toBe('moderate');
  });

  it('returns low for successRate < 0.6', () => {
    expect(getReliabilityTier(0.59, 5)).toBe('low');
    expect(getReliabilityTier(0, 5)).toBe('low');
  });
});

// --- getReliabilityLabel ---
describe('getReliabilityLabel', () => {
  it('high -> Reliable', () => expect(getReliabilityLabel('high')).toBe('Reliable'));
  it('moderate -> Inconsistent', () => expect(getReliabilityLabel('moderate')).toBe('Inconsistent'));
  it('low -> Unreliable', () => expect(getReliabilityLabel('low')).toBe('Unreliable'));
  it('insufficient_data -> Insufficient Data', () =>
    expect(getReliabilityLabel('insufficient_data')).toBe('Insufficient Data'));
});

// --- formatSuccessRate ---
describe('formatSuccessRate', () => {
  it('formats 1 as 100.0%', () => expect(formatSuccessRate(1)).toBe('100.0%'));
  it('formats 0 as 0.0%', () => expect(formatSuccessRate(0)).toBe('0.0%'));
  it('formats 0.857 as 85.7%', () => expect(formatSuccessRate(0.857)).toBe('85.7%'));
});

// --- analyzeHandoffSuccessRate integration ---
describe('analyzeHandoffSuccessRate', () => {
  it('returns empty agents when no sessions', async () => {
    buildSelect([]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.totalAgents).toBe(0);
    expect(result.projectId).toBe('proj1');
    expect(result.generatedAt).toBeTruthy();
  });

  it('returns insufficient_data for agent with < 3 sessions', async () => {
    buildSelect([
      makeSession('AgentA', 'completed'),
      makeSession('AgentA', 'completed'),
    ]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(result.agents[0].reliabilityTier).toBe('insufficient_data');
  });

  it('counts completedSessions correctly', async () => {
    buildSelect([
      makeSession('AgentB', 'completed'),
      makeSession('AgentB', 'completed'),
      makeSession('AgentB', 'pending'),
      makeSession('AgentB', 'failed'),
    ]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(result.agents[0].completedSessions).toBe(2);
    expect(result.agents[0].totalSessions).toBe(4);
  });

  it('counts stalledSessions for failed and timeout statuses', async () => {
    buildSelect([
      makeSession('AgentC', 'failed'),
      makeSession('AgentC', 'timeout'),
      makeSession('AgentC', 'completed'),
      makeSession('AgentC', 'completed'),
    ]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(result.agents[0].stalledSessions).toBe(2);
  });

  it('computes avgCompletionMs from completed sessions with timestamps', async () => {
    const s1Start = new Date('2025-01-10T09:00:00Z');
    const s1End = new Date('2025-01-10T10:00:00Z'); // 3600000 ms
    const s2Start = new Date('2025-01-10T11:00:00Z');
    const s2End = new Date('2025-01-10T13:00:00Z'); // 7200000 ms
    buildSelect([
      makeSession('AgentD', 'completed', s1Start, s1End),
      makeSession('AgentD', 'completed', s2Start, s2End),
      makeSession('AgentD', 'completed', null, null), // no timestamps — excluded from avg
    ]);
    const result = await analyzeHandoffSuccessRate('proj1');
    // avg of 3600000 and 7200000 = 5400000
    expect(result.agents[0].avgCompletionMs).toBe(5400000);
  });

  it('summary totalHandoffs equals total sessions across all agents', async () => {
    buildSelect([
      makeSession('A1', 'completed'),
      makeSession('A1', 'completed'),
      makeSession('A1', 'completed'),
      makeSession('A2', 'failed'),
      makeSession('A2', 'pending'),
      makeSession('A2', 'completed'),
    ]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(result.summary.totalHandoffs).toBe(6);
  });

  it('aiSummary and aiRecommendations are non-empty strings/arrays', async () => {
    buildSelect([]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(typeof result.aiSummary).toBe('string');
    expect(result.aiSummary.length).toBeGreaterThan(0);
    expect(Array.isArray(result.aiRecommendations)).toBe(true);
    expect(result.aiRecommendations.length).toBeGreaterThan(0);
  });

  it('agents sorted by successRate descending', async () => {
    buildSelect([
      makeSession('Low', 'failed'),
      makeSession('Low', 'failed'),
      makeSession('Low', 'failed'),
      makeSession('High', 'completed'),
      makeSession('High', 'completed'),
      makeSession('High', 'completed'),
    ]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(result.agents[0].agentName).toBe('High');
    expect(result.agents[1].agentName).toBe('Low');
  });

  it('summary highSuccessCount and lowSuccessCount correct', async () => {
    buildSelect([
      makeSession('HighAgent', 'completed'),
      makeSession('HighAgent', 'completed'),
      makeSession('HighAgent', 'completed'),
      makeSession('LowAgent', 'failed'),
      makeSession('LowAgent', 'failed'),
      makeSession('LowAgent', 'failed'),
    ]);
    const result = await analyzeHandoffSuccessRate('proj1');
    expect(result.summary.highSuccessCount).toBe(1);
    expect(result.summary.lowSuccessCount).toBe(1);
  });
});
