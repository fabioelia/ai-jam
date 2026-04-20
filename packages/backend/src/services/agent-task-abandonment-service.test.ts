import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentTaskAbandonment } from './agent-task-abandonment-service.js';

vi.mock('../db/connection.js', () => ({
  db: { select: vi.fn() },
}));

vi.mock('@anthropic-ai/sdk', () => {
  const mockCreate = vi.fn().mockRejectedValue(new Error('AI unavailable'));
  class MockAnthropic {
    messages = { create: mockCreate };
  }
  return { default: MockAnthropic };
});

import { db } from '../db/connection.js';

function makeTicket(
  assignedPersona: string | null,
  status: string,
  createdAt: Date,
  updatedAt: Date,
) {
  return { assignedPersona, status, createdAt, updatedAt };
}

const NOW = new Date('2024-01-01T12:00:00Z');
const TWO_HRS_AGO = new Date('2024-01-01T10:00:00Z');
const THREE_HRS_AGO = new Date('2024-01-01T09:00:00Z');
const ONE_HR_AGO = new Date('2024-01-01T11:00:00Z');
const NINETY_MIN_AGO = new Date('2024-01-01T10:30:00Z');

function setupDb(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

describe('analyzeAgentTaskAbandonment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty agents when no tickets', async () => {
    setupDb([]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(report.agents).toEqual([]);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.mostReliableAgent).toBeNull();
  });

  it('returns empty agents when tickets have null assignedPersona', async () => {
    setupDb([
      makeTicket(null, 'in_progress', THREE_HRS_AGO, NOW),
      makeTicket(null, 'done', THREE_HRS_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(report.agents).toEqual([]);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('correctly identifies abandoned tasks (in_progress > 2hr)', async () => {
    setupDb([
      makeTicket('AgentA', 'in_progress', THREE_HRS_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentA')!;
    expect(agent.abandonedTasks).toBe(1);
    expect(agent.abandonmentRate).toBe(1);
  });

  it('does NOT flag in_progress tasks under 2hr as abandoned', async () => {
    setupDb([
      makeTicket('AgentB', 'in_progress', NINETY_MIN_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentB')!;
    expect(agent.abandonedTasks).toBe(0);
    expect(agent.abandonmentRate).toBe(0);
  });

  it('correctly classifies riskLevel based on abandonmentRate', async () => {
    // critical: rate >= 0.4, high: >= 0.25, moderate: >= 0.1, low: < 0.1
    setupDb([
      // AgentCritical: 2 abandoned out of 2 = rate 1.0 → critical
      makeTicket('AgentCritical', 'in_progress', THREE_HRS_AGO, NOW),
      makeTicket('AgentCritical', 'in_progress', THREE_HRS_AGO, NOW),
      // AgentHigh: 1 abandoned out of 3 = rate 0.333 → high
      makeTicket('AgentHigh', 'in_progress', THREE_HRS_AGO, NOW),
      makeTicket('AgentHigh', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentHigh', 'done', THREE_HRS_AGO, NOW),
      // AgentModerate: 1 abandoned out of 8 = rate 0.125 → moderate
      makeTicket('AgentModerate', 'in_progress', THREE_HRS_AGO, NOW),
      makeTicket('AgentModerate', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentModerate', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentModerate', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentModerate', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentModerate', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentModerate', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentModerate', 'done', THREE_HRS_AGO, NOW),
      // AgentLow: 0 abandoned out of 2 = rate 0.0 → low
      makeTicket('AgentLow', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentLow', 'done', THREE_HRS_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(report.agents.find((a) => a.agentPersona === 'AgentCritical')!.riskLevel).toBe('critical');
    expect(report.agents.find((a) => a.agentPersona === 'AgentHigh')!.riskLevel).toBe('high');
    expect(report.agents.find((a) => a.agentPersona === 'AgentModerate')!.riskLevel).toBe('moderate');
    expect(report.agents.find((a) => a.agentPersona === 'AgentLow')!.riskLevel).toBe('low');
  });

  it('sorts agents by abandonmentRate desc, then totalTasks desc within tie', async () => {
    setupDb([
      // AgentA: rate 0 (1 done, 0 abandoned), total 1
      makeTicket('AgentA', 'done', THREE_HRS_AGO, NOW),
      // AgentB: rate 0 (2 done, 0 abandoned), total 2 — same rate as AgentA but more tasks
      makeTicket('AgentB', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentB', 'done', THREE_HRS_AGO, NOW),
      // AgentC: rate 1.0 (1 abandoned), total 1
      makeTicket('AgentC', 'in_progress', THREE_HRS_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    // AgentC first (rate 1.0), then AgentB (rate 0, total 2), then AgentA (rate 0, total 1)
    expect(report.agents[0].agentPersona).toBe('AgentC');
    expect(report.agents[1].agentPersona).toBe('AgentB');
    expect(report.agents[2].agentPersona).toBe('AgentA');
  });

  it('correctly computes summary.highRiskAgents (threshold >= 0.25)', async () => {
    setupDb([
      // AgentX: rate 0.333 → high risk
      makeTicket('AgentX', 'in_progress', THREE_HRS_AGO, NOW),
      makeTicket('AgentX', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentX', 'done', THREE_HRS_AGO, NOW),
      // AgentY: rate 0.0 → not high risk
      makeTicket('AgentY', 'done', THREE_HRS_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(report.summary.highRiskAgents).toBe(1);
  });

  it('correctly identifies mostReliableAgent (min 2 total tasks, lowest abandonmentRate)', async () => {
    setupDb([
      // AgentSingle: rate 0 but only 1 task → excluded from reliable
      makeTicket('AgentSingle', 'done', THREE_HRS_AGO, NOW),
      // AgentGood: rate 0, 2 tasks → eligible
      makeTicket('AgentGood', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentGood', 'done', THREE_HRS_AGO, NOW),
      // AgentBad: rate 0.5, 2 tasks → eligible but worse
      makeTicket('AgentBad', 'in_progress', THREE_HRS_AGO, NOW),
      makeTicket('AgentBad', 'done', THREE_HRS_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    expect(report.summary.mostReliableAgent).toBe('AgentGood');
  });

  it('boundary: abandonmentRate exactly 0.25 → riskLevel high', async () => {
    setupDb([
      // 1 abandoned out of 4 = 0.25 exactly
      makeTicket('AgentEdge', 'in_progress', THREE_HRS_AGO, NOW),
      makeTicket('AgentEdge', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentEdge', 'done', THREE_HRS_AGO, NOW),
      makeTicket('AgentEdge', 'done', THREE_HRS_AGO, NOW),
    ]);
    const report = await analyzeAgentTaskAbandonment('proj-1');
    const agent = report.agents.find((a) => a.agentPersona === 'AgentEdge')!;
    expect(agent.abandonmentRate).toBe(0.25);
    expect(agent.riskLevel).toBe('high');
  });
});
