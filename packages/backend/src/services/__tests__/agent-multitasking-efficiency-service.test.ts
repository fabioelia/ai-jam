import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeMultitaskingScore,
  getMultitaskingTier,
  analyzeAgentMultitaskingEfficiency,
} from '../agent-multitasking-efficiency-service.js';

vi.mock('../../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"aiSummary":"ok","recommendations":["r1"]}' }],
        }),
      },
    };
  }),
}));

import { db } from '../../db/connection.js';

const NOW = Date.now();
function daysAgo(days: number): Date {
  return new Date(NOW - days * 86400000);
}
function makeTicket(
  assignedPersona: string | null,
  status: string,
  createdDaysAgo: number,
  updatedDaysAgo = 0,
) {
  return {
    id: Math.random().toString(),
    assignedPersona,
    status,
    createdAt: daysAgo(createdDaysAgo),
    updatedAt: daysAgo(updatedDaysAgo),
  };
}
function mockDbSelect(rows: ReturnType<typeof makeTicket>[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
  (db.select as ReturnType<typeof vi.fn>).mockReturnValue(chain);
}

beforeEach(() => vi.clearAllMocks());

describe('computeMultitaskingScore', () => {
  it('returns base multiTaskCompletionRate plus efficiency bonus, no penalty at avg<=3', () => {
    const score = computeMultitaskingScore(80, 0, 2);
    expect(score).toBe(90); // 80 + min(10, 1*10) = 90
  });

  it('applies penalty for avgConcurrentTasks above 3', () => {
    const score = computeMultitaskingScore(80, 0, 5);
    expect(score).toBe(80); // 80 + 10 - max(0,(5-3)*5)=10 → 80
  });

  it('clamps to 0 minimum', () => {
    expect(computeMultitaskingScore(0, 100, 10)).toBe(0);
  });

  it('clamps to 100 maximum', () => {
    expect(computeMultitaskingScore(100, 0, 1)).toBe(100);
  });
});

describe('getMultitaskingTier', () => {
  it('returns efficient for score >= 75', () => {
    expect(getMultitaskingTier(75)).toBe('efficient');
    expect(getMultitaskingTier(100)).toBe('efficient');
  });

  it('returns capable for score >= 50 and < 75', () => {
    expect(getMultitaskingTier(50)).toBe('capable');
    expect(getMultitaskingTier(74)).toBe('capable');
  });

  it('returns strained for score >= 25 and < 50', () => {
    expect(getMultitaskingTier(25)).toBe('strained');
    expect(getMultitaskingTier(49)).toBe('strained');
  });

  it('returns overwhelmed for score < 25', () => {
    expect(getMultitaskingTier(0)).toBe('overwhelmed');
    expect(getMultitaskingTier(24)).toBe('overwhelmed');
  });
});

describe('analyzeAgentMultitaskingEfficiency', () => {
  it('returns empty report when project has no tickets', async () => {
    mockDbSelect([]);
    const report = await analyzeAgentMultitaskingEfficiency('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.avgMultitaskingScore).toBe(0);
    expect(report.projectId).toBe('proj-1');
    expect(report.generatedAt).toBeDefined();
  });

  it('returns spec-compliant agent metrics with required fields', async () => {
    mockDbSelect([makeTicket('Alpha', 'done', 5, 1)]);
    const report = await analyzeAgentMultitaskingEfficiency('proj-1');
    expect(report.agents).toHaveLength(1);
    const a = report.agents[0];
    expect(a.agentId).toBe('Alpha');
    expect(a.agentName).toBe('Alpha');
    expect(typeof a.totalSessions).toBe('number');
    expect(typeof a.multitaskingScore).toBe('number');
    expect(['efficient', 'capable', 'strained', 'overwhelmed']).toContain(a.multitaskingTier);
  });

  it('summary has mostEfficientAgent and mostOverloadedAgent', async () => {
    mockDbSelect([
      makeTicket('Alpha', 'done', 10, 5),
      makeTicket('Beta', 'backlog', 5, 1),
    ]);
    const report = await analyzeAgentMultitaskingEfficiency('proj-1');
    expect(['Alpha', 'Beta']).toContain(report.summary.mostEfficientAgent);
    expect(['Alpha', 'Beta']).toContain(report.summary.mostOverloadedAgent);
  });
});
