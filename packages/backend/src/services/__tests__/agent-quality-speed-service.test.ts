import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeTradeoffScore,
  getTradeoffTier,
  analyzeAgentQualitySpeed,
} from '../agent-quality-speed-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"insights":[],"recommendations":[]}' }],
      }),
    };
  },
}));

import { db } from '../../db/connection.js';

const NOW = Date.now();
function makeTicket(
  id: string,
  persona: string,
  status: string,
  hoursAgo: number,
  durationHours: number,
) {
  const createdAt = new Date(NOW - hoursAgo * 3600 * 1000);
  const updatedAt = new Date(createdAt.getTime() + durationHours * 3600 * 1000);
  return { id, assignedPersona: persona, status, createdAt, updatedAt, projectId: 'proj1' };
}

describe('computeTradeoffScore', () => {
  it('returns 100 for perfect inputs', () => {
    expect(computeTradeoffScore(100, 100, 0)).toBe(100);
  });

  it('returns 0 for worst inputs', () => {
    expect(computeTradeoffScore(0, 0, 96)).toBe(0);
  });

  it('clamps to 0 when completion time far exceeds 48h', () => {
    const score = computeTradeoffScore(0, 0, 200);
    expect(score).toBe(0);
  });
});

describe('getTradeoffTier', () => {
  it('returns optimized for score >= 75', () => {
    expect(getTradeoffTier(75)).toBe('optimized');
    expect(getTradeoffTier(100)).toBe('optimized');
  });

  it('returns balanced for score >= 55', () => {
    expect(getTradeoffTier(55)).toBe('balanced');
    expect(getTradeoffTier(74)).toBe('balanced');
  });

  it('returns quality-focused for score >= 40', () => {
    expect(getTradeoffTier(40)).toBe('quality-focused');
    expect(getTradeoffTier(54)).toBe('quality-focused');
  });

  it('returns speed-focused for score >= 25', () => {
    expect(getTradeoffTier(25)).toBe('speed-focused');
    expect(getTradeoffTier(39)).toBe('speed-focused');
  });

  it('returns struggling for score < 25', () => {
    expect(getTradeoffTier(24)).toBe('struggling');
    expect(getTradeoffTier(0)).toBe('struggling');
  });
});

describe('analyzeAgentQualitySpeed', () => {
  beforeEach(() => {
    vi.mocked(db.where).mockResolvedValue([]);
  });

  it('returns zero agents for empty project', async () => {
    vi.mocked(db.where).mockResolvedValue([]);
    const report = await analyzeAgentQualitySpeed('proj1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('identifies mostOptimizedAgent as highest tradeoffScore agent', async () => {
    const data = [
      makeTicket('t1', 'AgentA', 'done', 100, 10),
      makeTicket('t2', 'AgentA', 'done', 200, 8),
      makeTicket('t3', 'AgentB', 'done', 100, 200),
      makeTicket('t4', 'AgentB', 'in_progress', 50, 0),
    ];
    vi.mocked(db.where).mockResolvedValue(data);
    const report = await analyzeAgentQualitySpeed('proj1');
    expect(report.summary.mostOptimizedAgent).toBe('AgentA');
  });

  it('identifies mostStrugglingAgent as lowest tradeoffScore agent', async () => {
    const data = [
      makeTicket('t1', 'AgentA', 'done', 100, 10),
      makeTicket('t2', 'AgentB', 'done', 100, 300),
      makeTicket('t3', 'AgentB', 'review', 50, 0),
    ];
    vi.mocked(db.where).mockResolvedValue(data);
    const report = await analyzeAgentQualitySpeed('proj1');
    expect(report.summary.mostStrugglingAgent).toBe('AgentB');
  });

  it('counts optimizedAgentCount correctly', async () => {
    // AgentA: high first-pass, fast — should be optimized
    const data = [
      makeTicket('t1', 'AgentA', 'done', 100, 5),
      makeTicket('t2', 'AgentA', 'done', 200, 6),
      makeTicket('t3', 'AgentB', 'done', 100, 300),
    ];
    vi.mocked(db.where).mockResolvedValue(data);
    const report = await analyzeAgentQualitySpeed('proj1');
    const optimized = report.agents.filter((a) => a.tradeoffTier === 'optimized');
    expect(report.summary.optimizedAgentCount).toBe(optimized.length);
  });
});
