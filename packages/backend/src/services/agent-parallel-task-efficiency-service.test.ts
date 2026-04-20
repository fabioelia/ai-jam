import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  analyzeAgentParallelTaskEfficiency,
  buildAgentMetrics,
  computeEfficiencyScore,
  efficiencyTier,
  FALLBACK_SUMMARY,
  FALLBACK_RECOMMENDATIONS,
} from './agent-parallel-task-efficiency-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                summary: 'AI parallel task summary.',
                recommendations: ['Limit parallel tasks to 3 per agent.'],
              }),
            },
          ],
        }),
      },
    };
  }),
}));

import { db } from '../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

const BASE_TIME = new Date('2026-04-20T10:00:00Z').getTime();

type SessionRow = {
  id: string;
  personaType: string;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
};

function makeSession(
  id: string,
  personaType: string,
  status: string,
  startOffsetMs: number,
  durationMs: number,
): SessionRow {
  const startedAt = new Date(BASE_TIME + startOffsetMs);
  const completedAt = status !== 'pending' ? new Date(BASE_TIME + startOffsetMs + durationMs) : null;
  return { id, personaType, status, startedAt, completedAt };
}

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

beforeEach(() => vi.clearAllMocks());

// Test 1: empty project returns empty agents array
it('empty project returns empty agents array', async () => {
  mockDb([], []);
  const report = await analyzeAgentParallelTaskEfficiency('proj-empty');
  expect(report.agents).toHaveLength(0);
  expect(report.summary.totalAgents).toBe(0);
  expect(report.summary.totalTasks).toBe(0);
  expect(report.summary.mostEfficientAgent).toBeNull();
});

// Test 2: single agent with no parallel tasks has correct efficiencyScore
it('single agent with no parallel tasks has correct efficiencyScore', async () => {
  // Sessions that do NOT overlap: sequential tasks
  const sessions: SessionRow[] = [
    makeSession('s1', 'AgentA', 'completed', 0, 30 * 60000),       // 10:00 - 10:30
    makeSession('s2', 'AgentA', 'completed', 60 * 60000, 30 * 60000), // 11:00 - 11:30
  ];
  const metrics = buildAgentMetrics(sessions);
  const agent = metrics.find((m) => m.agentId === 'AgentA');
  expect(agent).toBeDefined();
  // No overlap => parallelTasks = 0, parallelCompletionRate = 0
  expect(agent!.parallelTasks).toBe(0);
  // efficiencyScore: base=0, penalty=-15 (parallelCompletionRate<50) → clamped to 0
  expect(agent!.efficiencyScore).toBe(0);
});

// Test 3: expert tier agent (efficiencyScore >= 85)
it('expert tier agent has efficiencyScore >= 85 and tier expert', () => {
  // parallelCompletionRate=90, avgConcurrentTasks=3 → score=90+10=100 → expert
  const score = computeEfficiencyScore(90, 3);
  expect(score).toBeGreaterThanOrEqual(85);
  expect(efficiencyTier(score)).toBe('expert');
});

// Test 4: overwhelmed tier agent (efficiencyScore < 40)
it('overwhelmed tier agent has efficiencyScore < 40 and tier overwhelmed', () => {
  // parallelCompletionRate=20, avgConcurrentTasks=1 → score=20-15=5 → overwhelmed
  const score = computeEfficiencyScore(20, 1);
  expect(score).toBeLessThan(40);
  expect(efficiencyTier(score)).toBe('overwhelmed');
});

// Test 5: bonus applied when avgConcurrentTasks >= 3 AND parallelCompletionRate >= 80
it('bonus of +10 applied when avgConcurrentTasks >= 3 AND parallelCompletionRate >= 80', () => {
  const withBonus = computeEfficiencyScore(80, 3);
  const withoutBonus = computeEfficiencyScore(80, 2);
  expect(withBonus).toBe(withoutBonus + 10);
});

// Test 6: penalty applied when parallelCompletionRate < 50
it('penalty of -15 applied when parallelCompletionRate < 50', () => {
  const withPenalty = computeEfficiencyScore(49, 1);
  const withoutPenalty = computeEfficiencyScore(50, 1);
  // withoutPenalty = 50, withPenalty = 49 - 15 = 34
  expect(withPenalty).toBe(withoutPenalty - 15);
});

// Test 7: mostEfficientAgent correctly identified
it('mostEfficientAgent is the agent with the highest efficiencyScore', async () => {
  // AgentA: parallel, high completion → expert
  // AgentB: parallel, low completion → overwhelmed
  const sessions: SessionRow[] = [
    // AgentA: 3 overlapping sessions, all completed
    makeSession('a1', 'AgentA', 'completed', 0, 60 * 60000),
    makeSession('a2', 'AgentA', 'completed', 10 * 60000, 60 * 60000),
    makeSession('a3', 'AgentA', 'completed', 20 * 60000, 60 * 60000),
    makeSession('a4', 'AgentA', 'completed', 30 * 60000, 60 * 60000),
    // AgentB: 2 overlapping sessions, none completed
    makeSession('b1', 'AgentB', 'failed', 0, 30 * 60000),
    makeSession('b2', 'AgentB', 'failed', 15 * 60000, 30 * 60000),
  ];
  const metrics = buildAgentMetrics(sessions);
  expect(metrics[0].agentId).toBe('AgentA');
  expect(metrics[0].efficiencyScore).toBeGreaterThan(metrics[1].efficiencyScore);
});

// Test 8: AI summary fallback on error
it('AI summary falls back gracefully on AI error', async () => {
  const AnthropicMock = Anthropic as unknown as ReturnType<typeof vi.fn>;
  AnthropicMock.mockImplementationOnce(function () {
    return {
      messages: {
        create: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
      },
    };
  });

  const sessions: SessionRow[] = [
    makeSession('s1', 'AgentA', 'completed', 0, 30 * 60000),
    makeSession('s2', 'AgentA', 'completed', 15 * 60000, 30 * 60000),
  ];
  mockDb([{ id: 't1' }], sessions);

  const report = await analyzeAgentParallelTaskEfficiency('proj-1');
  expect(report.aiSummary).toBe(FALLBACK_SUMMARY);
  expect(report.aiRecommendations).toEqual(FALLBACK_RECOMMENDATIONS);
});
