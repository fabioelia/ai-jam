import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeWorkloadFairness } from './agent-workload-fairness-service.js';

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

function makeTickets(rows: { assignedPersona: string; status: string; updatedAt: Date }[]) {
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

const now = new Date();
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeWorkloadFairness', () => {
  it('returns empty agents and fairnessScore=100 when no tickets', async () => {
    buildSelect([]);
    const result = await analyzeWorkloadFairness('proj1');
    expect(result.agents).toHaveLength(0);
    expect(result.fairnessScore).toBe(100);
    expect(result.totalActiveTickets).toBe(0);
  });

  it('single agent with active tickets is balanced', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentA', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'AgentA', status: 'in_progress', updatedAt: daysAgo(2) },
    ]));
    const result = await analyzeWorkloadFairness('proj1');
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].status).toBe('balanced');
    expect(result.agents[0].workloadShare).toBe(100);
    expect(result.fairnessScore).toBe(100);
  });

  it('equal distribution → both agents balanced', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentA', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'AgentA', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'AgentB', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'AgentB', status: 'in_progress', updatedAt: daysAgo(3) },
    ]));
    const result = await analyzeWorkloadFairness('proj1');
    expect(result.agents).toHaveLength(2);
    result.agents.forEach(a => expect(a.status).toBe('balanced'));
    expect(result.fairnessScore).toBe(100);
  });

  it('overloaded agent detected when workloadShare > idealShare*1.5', async () => {
    // 4 agents: heavy has 4 active, 3 light have 1 each → total=7, idealShare=25%
    // heavy share = 4/7*100 ≈ 57.1% > 25*1.5=37.5% → overloaded
    buildSelect(makeTickets([
      { assignedPersona: 'Heavy', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Heavy', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Heavy', status: 'in_progress', updatedAt: daysAgo(3) },
      { assignedPersona: 'Heavy', status: 'in_progress', updatedAt: daysAgo(4) },
      { assignedPersona: 'Light1', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Light2', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Light3', status: 'in_progress', updatedAt: daysAgo(1) },
    ]));
    const result = await analyzeWorkloadFairness('proj1');
    const heavy = result.agents.find(a => a.agentPersona === 'Heavy');
    expect(heavy?.status).toBe('overloaded');
    expect(result.agents[0].agentPersona).toBe('Heavy'); // sorted first
  });

  it('underloaded agent detected when workloadShare < idealShare*0.5', async () => {
    // 4 agents: idle has 0 active but 1 done in 7d; 3 active have 3 each → total=9, idealShare=25%
    // idle share = 0/9*100 = 0% < 25*0.5=12.5% → underloaded
    buildSelect(makeTickets([
      { assignedPersona: 'Idle', status: 'done', updatedAt: daysAgo(2) },
      { assignedPersona: 'Active1', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Active1', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Active1', status: 'in_progress', updatedAt: daysAgo(3) },
      { assignedPersona: 'Active2', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Active2', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Active2', status: 'in_progress', updatedAt: daysAgo(3) },
      { assignedPersona: 'Active3', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Active3', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Active3', status: 'in_progress', updatedAt: daysAgo(3) },
    ]));
    const result = await analyzeWorkloadFairness('proj1');
    const idle = result.agents.find(a => a.agentPersona === 'Idle');
    expect(idle?.status).toBe('underloaded');
  });

  it('completedLast7d counts done tickets updated within 7 days, excludes older done', async () => {
    buildSelect(makeTickets([
      { assignedPersona: 'AgentA', status: 'done', updatedAt: daysAgo(3) },  // recent done
      { assignedPersona: 'AgentA', status: 'done', updatedAt: daysAgo(14) }, // old done — excluded from qualifying
      { assignedPersona: 'AgentA', status: 'in_progress', updatedAt: daysAgo(1) },
    ]));
    const result = await analyzeWorkloadFairness('proj1');
    expect(result.agents).toHaveLength(1);
    expect(result.agents[0].completedLast7d).toBe(1);
    expect(result.agents[0].activeTickets).toBe(1);
  });

  it('sort order: overloaded → balanced → underloaded', async () => {
    // Build scenario with all 3 statuses
    // 5 agents: 1 overloaded, 2 balanced, 1 underloaded + idle (done only)
    // Total active = 8 + 2 + 2 + 1 = 13 (ignore done-only for active count)
    // Actually simpler: 4 agents, idealShare=25%
    // Over: 6/12=50% > 37.5% → overloaded
    // Balanced1: 3/12=25% = 25% → balanced
    // Balanced2: 3/12=25% → balanced
    // Under: 0/12=0% + 1 done in 7d → underloaded
    buildSelect(makeTickets([
      { assignedPersona: 'Over', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Over', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Over', status: 'in_progress', updatedAt: daysAgo(3) },
      { assignedPersona: 'Over', status: 'in_progress', updatedAt: daysAgo(4) },
      { assignedPersona: 'Over', status: 'in_progress', updatedAt: daysAgo(5) },
      { assignedPersona: 'Over', status: 'in_progress', updatedAt: daysAgo(6) },
      { assignedPersona: 'Bal1', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Bal1', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Bal1', status: 'in_progress', updatedAt: daysAgo(3) },
      { assignedPersona: 'Bal2', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Bal2', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Bal2', status: 'in_progress', updatedAt: daysAgo(3) },
      { assignedPersona: 'Under', status: 'done', updatedAt: daysAgo(2) }, // qualifies via done7d
    ]));
    const result = await analyzeWorkloadFairness('proj1');
    expect(result.agents[0].status).toBe('overloaded');
    expect(result.agents[result.agents.length - 1].status).toBe('underloaded');
  });

  it('fairnessScore = max(0, round(100 - avgDeviation*2))', async () => {
    // 2 agents: A has 3 active, B has 1 active → total=4, idealShare=50%
    // A: share=75%, deviation=25; B: share=25%, deviation=25; avgDev=25
    // fairnessScore = round(100 - 25*2) = 50
    buildSelect(makeTickets([
      { assignedPersona: 'Heavy', status: 'in_progress', updatedAt: daysAgo(1) },
      { assignedPersona: 'Heavy', status: 'in_progress', updatedAt: daysAgo(2) },
      { assignedPersona: 'Heavy', status: 'in_progress', updatedAt: daysAgo(3) },
      { assignedPersona: 'Light', status: 'in_progress', updatedAt: daysAgo(1) },
    ]));
    const result = await analyzeWorkloadFairness('proj1');
    expect(result.fairnessScore).toBe(50);
  });
});
