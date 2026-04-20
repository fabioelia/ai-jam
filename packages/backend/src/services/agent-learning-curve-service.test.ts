import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentLearningCurves } from './agent-learning-curve-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../db/connection.js';

const mockSelect = (rows: object[]) => {
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  });
};

const now = new Date();

function daysAgo(d: number): string {
  return new Date(now.getTime() - d * 24 * 60 * 60 * 1000).toISOString();
}

function weekAgo(w: number, daysOffset = 0): string {
  return new Date(now.getTime() - (w * 7 + daysOffset) * 24 * 60 * 60 * 1000).toISOString();
}

function makeDoneTicket(persona: string, weeksAgo: number, createdDaysBeforeUpdate = 1) {
  const updatedAt = new Date(now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  const createdAt = new Date(updatedAt.getTime() - createdDaysBeforeUpdate * 24 * 60 * 60 * 1000);
  return {
    assignedPersona: persona,
    status: 'done',
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentLearningCurves', () => {
  it('empty project returns agents: []', async () => {
    mockSelect([]);
    const result = await analyzeAgentLearningCurves('proj-1');
    expect(result.agents).toEqual([]);
    expect(result.windowWeeks).toBe(8);
  });

  it('single agent, single week → 1 snapshot, slope=0, trend=stable', async () => {
    mockSelect([makeDoneTicket('Alice', 1)]);
    const result = await analyzeAgentLearningCurves('proj-1');
    expect(result.agents).toHaveLength(1);
    const agent = result.agents[0];
    expect(agent.snapshots).toHaveLength(1);
    expect(agent.improvementSlope).toBe(0);
    expect(agent.trend).toBe('stable');
  });

  it('agent improving over 4 weeks → trend=improving, slope>1', async () => {
    // Create tickets with increasing quality scores by varying completion times
    // week 4 ago: slow completion (low quality), week 1 ago: fast (high quality)
    // To get improving: quality goes from low to high
    // quality = % completed within 14 days
    // week 4: completed slowly (20d = rejected quality=0)
    // week 3: 50% fast
    // week 2: 75% fast
    // week 1: 100% fast
    const rows = [
      // week 4: 1 ticket, 20 day completion = quality 0
      { assignedPersona: 'Bob', status: 'done', ...datesAt(4, 20) },
      // week 3: 2 tickets: 1 fast, 1 slow
      { assignedPersona: 'Bob', status: 'done', ...datesAt(3, 1) },
      { assignedPersona: 'Bob', status: 'done', ...datesAt(3, 20) },
      // week 2: 3 fast, 1 slow
      { assignedPersona: 'Bob', status: 'done', ...datesAt(2, 1) },
      { assignedPersona: 'Bob', status: 'done', ...datesAt(2, 1) },
      { assignedPersona: 'Bob', status: 'done', ...datesAt(2, 1) },
      { assignedPersona: 'Bob', status: 'done', ...datesAt(2, 20) },
      // week 1: all fast (quality 100)
      { assignedPersona: 'Bob', status: 'done', ...datesAt(1, 1) },
      { assignedPersona: 'Bob', status: 'done', ...datesAt(1, 1) },
      { assignedPersona: 'Bob', status: 'done', ...datesAt(1, 1) },
    ];
    mockSelect(rows);
    const result = await analyzeAgentLearningCurves('proj-1');
    const agent = result.agents[0];
    expect(agent.trend).toBe('improving');
    expect(agent.improvementSlope).toBeGreaterThan(1);
  });

  it('agent declining over 4 weeks → trend=declining, slope<-1', async () => {
    // quality goes from high (week 4) to low (week 1)
    const rows = [
      // week 4: all fast (quality 100)
      { assignedPersona: 'Carol', status: 'done', ...datesAt(4, 1) },
      { assignedPersona: 'Carol', status: 'done', ...datesAt(4, 1) },
      { assignedPersona: 'Carol', status: 'done', ...datesAt(4, 1) },
      // week 3: 75% fast
      { assignedPersona: 'Carol', status: 'done', ...datesAt(3, 1) },
      { assignedPersona: 'Carol', status: 'done', ...datesAt(3, 1) },
      { assignedPersona: 'Carol', status: 'done', ...datesAt(3, 1) },
      { assignedPersona: 'Carol', status: 'done', ...datesAt(3, 20) },
      // week 2: 50%
      { assignedPersona: 'Carol', status: 'done', ...datesAt(2, 1) },
      { assignedPersona: 'Carol', status: 'done', ...datesAt(2, 20) },
      // week 1: 1 ticket, slow (quality 0)
      { assignedPersona: 'Carol', status: 'done', ...datesAt(1, 20) },
    ];
    mockSelect(rows);
    const result = await analyzeAgentLearningCurves('proj-1');
    const agent = result.agents[0];
    expect(agent.trend).toBe('declining');
    expect(agent.improvementSlope).toBeLessThan(-1);
  });

  it('agent stable high → recommendation contains "complex task routing"', async () => {
    // quality ~80 for several weeks (all fast completions)
    const rows = [
      { assignedPersona: 'Dave', status: 'done', ...datesAt(4, 1) },
      { assignedPersona: 'Dave', status: 'done', ...datesAt(3, 1) },
      { assignedPersona: 'Dave', status: 'done', ...datesAt(2, 1) },
      { assignedPersona: 'Dave', status: 'done', ...datesAt(1, 1) },
    ];
    mockSelect(rows);
    const result = await analyzeAgentLearningCurves('proj-1');
    const agent = result.agents[0];
    // All quality=100, slope=0, trend=stable, currentQualityScore=100 >= 70
    expect(agent.trend).toBe('stable');
    expect(agent.currentQualityScore).toBeGreaterThanOrEqual(70);
    expect(agent.recommendation).toContain('complex task routing');
  });

  it('agent plateau (4+ stagnation weeks) → stagnationWeeks >= 4, recommendation contains "Plateau"', async () => {
    // 5 weeks of identical quality (40% each week = 2 fast / 5 total)
    const make2fast3slow = (w: number) => [
      { assignedPersona: 'Eve', status: 'done', ...datesAt(w, 1) },
      { assignedPersona: 'Eve', status: 'done', ...datesAt(w, 1) },
      { assignedPersona: 'Eve', status: 'done', ...datesAt(w, 20) },
      { assignedPersona: 'Eve', status: 'done', ...datesAt(w, 20) },
      { assignedPersona: 'Eve', status: 'done', ...datesAt(w, 20) },
    ];
    const rows = [
      ...make2fast3slow(7),
      ...make2fast3slow(6),
      ...make2fast3slow(5),
      ...make2fast3slow(4),
      ...make2fast3slow(3),
    ];
    mockSelect(rows);
    const result = await analyzeAgentLearningCurves('proj-1');
    const agent = result.agents[0];
    expect(agent.stagnationWeeks).toBeGreaterThanOrEqual(4);
    expect(agent.recommendation).toContain('Plateau');
  });

  it('agent declining low quality → recommendation contains "model or prompt change"', async () => {
    // declining slope < -1 AND currentQualityScore < 40
    const rows = [
      // week 4: quality 80 (4 fast)
      { assignedPersona: 'Frank', status: 'done', ...datesAt(4, 1) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(4, 1) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(4, 1) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(4, 1) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(4, 20) },
      // week 3: quality 40 (2 fast, 3 slow)
      { assignedPersona: 'Frank', status: 'done', ...datesAt(3, 1) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(3, 1) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(3, 20) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(3, 20) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(3, 20) },
      // week 2: quality 20 (1 fast, 4 slow)
      { assignedPersona: 'Frank', status: 'done', ...datesAt(2, 1) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(2, 20) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(2, 20) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(2, 20) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(2, 20) },
      // week 1: quality 0 (all slow)
      { assignedPersona: 'Frank', status: 'done', ...datesAt(1, 20) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(1, 20) },
      { assignedPersona: 'Frank', status: 'done', ...datesAt(1, 20) },
    ];
    mockSelect(rows);
    const result = await analyzeAgentLearningCurves('proj-1');
    const agent = result.agents[0];
    expect(agent.trend).toBe('declining');
    expect(agent.currentQualityScore).toBeLessThan(40);
    expect(agent.recommendation).toContain('model or prompt change');
  });

  it('multiple agents sorted desc by currentQualityScore', async () => {
    const rows = [
      // Agent A: quality 100 in week 1
      { assignedPersona: 'AgentA', status: 'done', ...datesAt(1, 1) },
      // Agent B: quality 0 in week 1 (slow)
      { assignedPersona: 'AgentB', status: 'done', ...datesAt(1, 20) },
      // Agent C: quality 50 in week 1
      { assignedPersona: 'AgentC', status: 'done', ...datesAt(1, 1) },
      { assignedPersona: 'AgentC', status: 'done', ...datesAt(1, 20) },
    ];
    mockSelect(rows);
    const result = await analyzeAgentLearningCurves('proj-1');
    const scores = result.agents.map(a => a.currentQualityScore);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
    }
  });
});

function datesAt(weeksAgo: number, completionDays: number) {
  const updatedAt = new Date(now.getTime() - weeksAgo * 7 * 24 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  const createdAt = new Date(updatedAt.getTime() - completionDays * 24 * 60 * 60 * 1000);
  return {
    createdAt: createdAt.toISOString(),
    updatedAt: updatedAt.toISOString(),
  };
}
