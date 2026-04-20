import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeConsumptionScore,
  getConsumptionTier,
  analyzeAgentResourceConsumption,
} from '../agent-resource-consumption-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

import { db } from '../../db/connection.js';

describe('computeConsumptionScore', () => {
  it('returns 100 for zero usage', () => {
    expect(computeConsumptionScore(0, 0, 0)).toBe(100);
  });

  it('returns lower score for high token usage', () => {
    // 1000 tokens/task => (1000/1000)*40 = 40 rawScore => 100-40 = 60
    expect(computeConsumptionScore(1000, 0, 0)).toBe(60);
  });

  it('clamps to 0 for excessive usage', () => {
    expect(computeConsumptionScore(10000, 100, 600000)).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    expect(computeConsumptionScore(0, 0, 0)).toBe(100);
  });
});

describe('getConsumptionTier', () => {
  it('returns all 4 tiers correctly', () => {
    expect(getConsumptionTier(75)).toBe('efficient');
    expect(getConsumptionTier(50)).toBe('normal');
    expect(getConsumptionTier(25)).toBe('heavy');
    expect(getConsumptionTier(24)).toBe('excessive');
    expect(getConsumptionTier(100)).toBe('efficient');
    expect(getConsumptionTier(74)).toBe('normal');
  });
});

describe('analyzeAgentResourceConsumption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty report when no tickets', async () => {
    const selectMock = vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    });
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentResourceConsumption('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('returns correct report shape with agents', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([{ id: 'ticket-1' }]);
          }
          return Promise.resolve([
            {
              personaType: 'AgentA',
              costTokensIn: 400,
              costTokensOut: 600,
              retryCount: 1,
              startedAt: new Date('2026-01-01T10:00:00Z'),
              completedAt: new Date('2026-01-01T10:01:00Z'),
            },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentResourceConsumption('proj-1');
    expect(report.agents).toHaveLength(1);
    expect(report.agents[0].agentId).toBe('AgentA');
    expect(report.agents[0].totalTokensUsed).toBe(1000);
  });

  it('populates summary fields correctly', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([{ id: 'ticket-1' }, { id: 'ticket-2' }]);
          }
          return Promise.resolve([
            {
              personaType: 'AgentA',
              costTokensIn: 200,
              costTokensOut: 300,
              retryCount: 0,
              startedAt: new Date('2026-01-01T10:00:00Z'),
              completedAt: new Date('2026-01-01T10:00:30Z'),
            },
            {
              personaType: 'AgentB',
              costTokensIn: 800,
              costTokensOut: 1200,
              retryCount: 2,
              startedAt: new Date('2026-01-01T10:00:00Z'),
              completedAt: new Date('2026-01-01T10:05:00Z'),
            },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentResourceConsumption('proj-1');
    expect(report.summary.totalAgents).toBe(2);
    expect(report.summary.totalTokensUsed).toBe(2500);
    expect(report.summary.mostEfficient).toBeTruthy();
    expect(report.summary.mostExpensive).toBeTruthy();
  });
});
