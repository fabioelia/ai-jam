import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentResourceConsumption,
  computeConsumptionScore,
  getConsumptionTier,
} from './agent-resource-consumption-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../db/connection.js';

type SessionRow = {
  personaType: string;
  costTokensIn: number | null;
  costTokensOut: number | null;
  retryCount: number | null;
  startedAt: Date | null;
  completedAt: Date | null;
};

function mockDb(
  ticketRows: { id: string }[],
  sessionRows: SessionRow[],
) {
  let callCount = 0;
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(ticketRows);
      return Promise.resolve(sessionRows);
    }),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

function makeSession(
  personaType: string,
  tokensIn: number,
  tokensOut: number,
  retryCount: number,
  durationMs: number,
): SessionRow {
  const startedAt = new Date('2026-04-20T00:00:00Z');
  const completedAt = new Date(startedAt.getTime() + durationMs);
  return { personaType, costTokensIn: tokensIn, costTokensOut: tokensOut, retryCount, startedAt, completedAt };
}

beforeEach(() => vi.clearAllMocks());

describe('analyzeAgentResourceConsumption', () => {
  it('returns empty agents when no sessions exist', async () => {
    mockDb([], []);
    const report = await analyzeAgentResourceConsumption('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('correctly aggregates tokens/calls/duration per agent', async () => {
    mockDb(
      [{ id: 't1' }],
      [
        makeSession('AgentA', 500, 500, 1, 60000),
        makeSession('AgentA', 300, 200, 0, 30000),
      ],
    );
    const report = await analyzeAgentResourceConsumption('proj-1');
    const agentA = report.agents.find(a => a.agentId === 'AgentA');
    expect(agentA).toBeDefined();
    expect(agentA!.totalTasks).toBe(2);
    expect(agentA!.totalTokensUsed).toBe(500 + 500 + 300 + 200);
    // retryCount+1 per session: (1+1)+(0+1)=3 total
    expect(agentA!.totalApiCalls).toBe(3);
    expect(agentA!.avgSessionDurationMs).toBe(45000); // (60000+30000)/2
  });

  it('assigns efficient tier when score >= 75', () => {
    // score=100 → efficient
    expect(getConsumptionTier(100)).toBe('efficient');
    expect(getConsumptionTier(75)).toBe('efficient');
  });

  it('assigns normal tier when score >= 50 and < 75', () => {
    expect(getConsumptionTier(74)).toBe('normal');
    expect(getConsumptionTier(50)).toBe('normal');
  });

  it('assigns heavy tier when score >= 25 and < 50', () => {
    expect(getConsumptionTier(49)).toBe('heavy');
    expect(getConsumptionTier(25)).toBe('heavy');
  });

  it('assigns excessive tier when score < 25', () => {
    expect(getConsumptionTier(24)).toBe('excessive');
    expect(getConsumptionTier(0)).toBe('excessive');
  });

  it('computeConsumptionScore formula: rawScore = tokens/1000*40 + calls/10*35 + dur/60000*25', () => {
    // avgTokensPerTask=1000, avgApiCallsPerTask=10, avgSessionDurationMs=60000
    // rawScore = (1000/1000)*40 + (10/10)*35 + (60000/60000)*25 = 40+35+25 = 100
    // score = clamp(100-100, 0, 100) = 0
    const score = computeConsumptionScore(1000, 10, 60000);
    expect(score).toBe(0);
  });

  it('mostEfficient has highest score, mostExpensive has lowest score', async () => {
    mockDb(
      [{ id: 't1' }],
      [
        // AgentEfficient: 0 tokens, 0 api calls, 0 duration → score = 100
        makeSession('Efficient', 0, 0, 0, 0),
        // AgentHeavy: 2000 tokens, 20 calls, 120000ms → score likely low
        makeSession('Heavy', 1000, 1000, 19, 120000),
      ],
    );
    const report = await analyzeAgentResourceConsumption('proj-1');
    expect(report.summary.mostEfficient).toBe('Efficient');
    expect(report.summary.mostExpensive).toBe('Heavy');
  });

  it('summary avgTokensPerAgent is correct', async () => {
    mockDb(
      [{ id: 't1' }],
      [
        makeSession('AgentA', 500, 500, 0, 0),  // 1000 tokens
        makeSession('AgentB', 200, 300, 0, 0),  // 500 tokens
      ],
    );
    const report = await analyzeAgentResourceConsumption('proj-1');
    // avgTokensPerAgent = (1000 + 500) / 2 = 750
    expect(report.summary.avgTokensPerAgent).toBe(750);
  });

  it('report has generatedAt field', async () => {
    mockDb([{ id: 't1' }], [makeSession('AgentA', 0, 0, 0, 0)]);
    const report = await analyzeAgentResourceConsumption('proj-1');
    expect(report).toHaveProperty('generatedAt');
    expect(typeof report.generatedAt).toBe('string');
    // should be valid ISO date
    expect(new Date(report.generatedAt).toString()).not.toBe('Invalid Date');
  });
});
