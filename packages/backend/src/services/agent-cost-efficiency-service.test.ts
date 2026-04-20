import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentCostEfficiency,
  buildCostEfficiencyProfiles,
  computeEfficiencyTier,
  computeCostEfficiencyScore,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
  type SessionRow,
} from './agent-cost-efficiency-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

const mockCreate = vi.fn().mockResolvedValue({
  content: [
    {
      type: 'text',
      text: JSON.stringify({
        summary: 'AI cost efficiency summary.',
        recommendations: ['Reduce token usage for wasteful agents.'],
      }),
    },
  ],
});

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

import { db } from '../db/connection.js';

function makeSession(
  personaType: string,
  status: string,
  costTokensIn = 0,
  costTokensOut = 0,
): SessionRow {
  return { personaType, status, costTokensIn, costTokensOut };
}

function mockDb(ticketRows: { id: string }[], sessionRows: SessionRow[]) {
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

beforeEach(() => vi.clearAllMocks());

// Test 1: Empty project → all zeros, null most/least efficient agents
it('empty project returns all zeros and null agents', async () => {
  mockDb([], []);
  const report = await analyzeAgentCostEfficiency('proj-empty');
  expect(report.agentMetrics).toHaveLength(0);
  expect(report.totalTokensUsed).toBe(0);
  expect(report.avgCostEfficiencyScore).toBe(0);
  expect(report.mostEfficientAgent).toBeNull();
  expect(report.leastEfficientAgent).toBeNull();
});

// Test 2: Single agent, no sessions → score 0, tier 'wasteful'
it('single agent with no sessions gets score 0 and wasteful tier', () => {
  const profiles = buildCostEfficiencyProfiles([]);
  expect(profiles).toHaveLength(0);
  // computeEfficiencyTier with score 0 = wasteful
  expect(computeEfficiencyTier(0)).toBe('wasteful');
  expect(computeCostEfficiencyScore(0, 0, 0)).toBe(0);
});

// Test 3: Single agent, all completed, low token use → tier 'optimal'
it('agent with all completed sessions and low token use gets optimal tier', () => {
  const sessions: SessionRow[] = [
    makeSession('AgentA', 'completed', 100, 100), // 200 tokens each
    makeSession('AgentA', 'completed', 100, 100),
    makeSession('AgentA', 'completed', 100, 100),
    makeSession('AgentA', 'completed', 100, 100),
    makeSession('AgentA', 'completed', 100, 100),
  ];
  const profiles = buildCostEfficiencyProfiles(sessions);
  const agentA = profiles.find((p) => p.personaId === 'AgentA')!;
  // completionRate = 100%, avgTokensPerSession = 200, utilizationEff = 100-0.2=99.8, sessionSuccessDensity = 5/10*100 = 50
  // score = 50*0.5 + 99.8*0.3 + 50*0.2 = 25 + 29.94 + 10 = 64.94 → 65
  expect(agentA.costEfficiencyScore).toBeGreaterThanOrEqual(55);
  expect(['optimal', 'efficient']).toContain(agentA.efficiencyTier);
});

// Test 4: Single agent, all completed, high token use → tier reduced
it('agent with high token use gets lower score than low token use', () => {
  const lowTokenSessions: SessionRow[] = [
    makeSession('AgentLow', 'completed', 100, 100),
    makeSession('AgentLow', 'completed', 100, 100),
  ];
  const highTokenSessions: SessionRow[] = [
    makeSession('AgentHigh', 'completed', 500000, 500000),
    makeSession('AgentHigh', 'completed', 500000, 500000),
  ];
  const lowProfiles = buildCostEfficiencyProfiles(lowTokenSessions);
  const highProfiles = buildCostEfficiencyProfiles(highTokenSessions);
  const lowAgent = lowProfiles[0];
  const highAgent = highProfiles[0];
  expect(lowAgent.costEfficiencyScore).toBeGreaterThan(highAgent.costEfficiencyScore);
});

// Test 5: Multiple agents → mostEfficientAgent/leastEfficientAgent correct
it('mostEfficientAgent and leastEfficientAgent are correctly identified', async () => {
  mockDb(
    [{ id: 't1' }],
    [
      makeSession('AgentA', 'completed', 100, 100),
      makeSession('AgentA', 'completed', 100, 100),
      makeSession('AgentA', 'completed', 100, 100),
      makeSession('AgentB', 'failed', 5000, 5000),
      makeSession('AgentB', 'failed', 5000, 5000),
      makeSession('AgentB', 'failed', 5000, 5000),
    ],
  );
  const report = await analyzeAgentCostEfficiency('proj-multi');
  expect(report.mostEfficientAgent).toBe('AgentA');
  expect(report.leastEfficientAgent).toBe('AgentB');
});

// Test 6: Partial completions → completionRate correct
it('partial completions produce correct completionRate in score', () => {
  const sessions: SessionRow[] = [
    makeSession('AgentA', 'completed', 0, 0),
    makeSession('AgentA', 'completed', 0, 0),
    makeSession('AgentA', 'failed', 0, 0),
    makeSession('AgentA', 'failed', 0, 0),
  ];
  const profiles = buildCostEfficiencyProfiles(sessions);
  const agentA = profiles[0];
  expect(agentA.completedSessions).toBe(2);
  expect(agentA.totalSessions).toBe(4);
  // completionRate = 50%
  // score = 50*0.5 + 100*0.3 + 20*0.2 = 25 + 30 + 4 = 59
  expect(agentA.costEfficiencyScore).toBe(59);
});

// Test 7: utilizationEfficiency clamps at 0 for very high token use
it('utilizationEfficiency clamps at 0 for very high token use', () => {
  const score = computeCostEfficiencyScore(2, 2, 200000);
  // completionRate = 100% → 100*0.5 = 50
  // utilizationEff = clamp(100 - 200000/1000, 0, 100) = clamp(-199900, 0, 100) = 0 → 0*0.3 = 0
  // sessionSuccessDensity = min(2/10, 1)*100 = 20 → 20*0.2 = 4
  // score = 50 + 0 + 4 = 54
  expect(score).toBe(54);
});

// Test 8: avgCostEfficiencyScore is mean of agent scores
it('avgCostEfficiencyScore is the mean of all agent scores', async () => {
  mockDb(
    [{ id: 't1' }],
    [
      makeSession('AgentA', 'completed', 0, 0),
      makeSession('AgentA', 'completed', 0, 0),
      makeSession('AgentB', 'failed', 0, 0),
      makeSession('AgentB', 'failed', 0, 0),
    ],
  );
  const report = await analyzeAgentCostEfficiency('proj-avg');
  const manualAvg = Math.round(
    report.agentMetrics.reduce((s, a) => s + a.costEfficiencyScore, 0) / report.agentMetrics.length,
  );
  expect(report.avgCostEfficiencyScore).toBe(manualAvg);
});
