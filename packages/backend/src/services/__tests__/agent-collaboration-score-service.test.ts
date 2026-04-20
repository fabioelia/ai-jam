import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeCollaborationScore,
  getCollaborationTier,
  analyzeAgentCollaboration,
} from '../agent-collaboration-score-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"aiSummary": "Test summary", "aiRecommendations": ["Test rec"]}' }],
      }),
    };
  },
}));

describe('computeCollaborationScore', () => {
  it('computes weighted formula correctly', () => {
    // 0.6*60 + 0.2*60 + 0.2*60 = 60, no bonus/penalty (totalCollabs=7, 5<=7<15)
    expect(computeCollaborationScore(60, 60, 60, 7)).toBe(60);
  });

  it('adds +5 bonus when totalCollaborations >= 15', () => {
    // 0.6*60 + 0.2*60 + 0.2*60 = 60 + 5 = 65
    expect(computeCollaborationScore(60, 60, 60, 15)).toBe(65);
  });

  it('subtracts 10 penalty when totalCollaborations < 5', () => {
    // 0.6*60 + 0.2*60 + 0.2*60 = 60 - 10 = 50
    expect(computeCollaborationScore(60, 60, 60, 4)).toBe(50);
  });

  it('clamps result to [0, 100]', () => {
    expect(computeCollaborationScore(0, 0, 0, 4)).toBe(0);
    expect(computeCollaborationScore(100, 100, 100, 15)).toBe(100);
  });
});

describe('getCollaborationTier', () => {
  it('returns synergistic for score >= 80', () => {
    expect(getCollaborationTier(80)).toBe('synergistic');
    expect(getCollaborationTier(100)).toBe('synergistic');
  });

  it('returns collaborative for score >= 60', () => {
    expect(getCollaborationTier(60)).toBe('collaborative');
    expect(getCollaborationTier(79)).toBe('collaborative');
  });

  it('returns functional for score >= 40', () => {
    expect(getCollaborationTier(40)).toBe('functional');
    expect(getCollaborationTier(59)).toBe('functional');
  });

  it('returns isolated for score < 40', () => {
    expect(getCollaborationTier(39)).toBe('isolated');
    expect(getCollaborationTier(0)).toBe('isolated');
  });
});

describe('analyzeAgentCollaboration', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty report when no sessions', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([]);

    const report = await analyzeAgentCollaboration('proj-1');
    expect(report.projectId).toBe('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.avgCollaborationScore).toBe(0);
  });

  it('populates summary fields correctly', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([
      { id: '1', ticketId: 't1', personaType: 'frontend-agent', status: 'completed', outputSummary: 'Done', retryCount: 0 },
      { id: '2', ticketId: 't1', personaType: 'backend-agent', status: 'completed', outputSummary: 'Done', retryCount: 0 },
    ]);

    const report = await analyzeAgentCollaboration('proj-1');
    expect(report.summary.totalAgents).toBe(2);
    expect(typeof report.summary.avgCollaborationScore).toBe('number');
    expect(typeof report.summary.mostCollaborativeAgent).toBe('string');
    expect(typeof report.summary.synergisticCount).toBe('number');
  });

  it('assigns collaborationTier to each agent', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([
      { id: '1', ticketId: 't1', personaType: 'agent-a', status: 'completed', outputSummary: 'Summary text', retryCount: 0 },
      { id: '2', ticketId: 't1', personaType: 'agent-b', status: 'completed', outputSummary: 'Summary text', retryCount: 0 },
    ]);

    const report = await analyzeAgentCollaboration('proj-1');
    const tiers = ['synergistic', 'collaborative', 'functional', 'isolated'];
    for (const agent of report.agents) {
      expect(tiers).toContain(agent.collaborationTier);
    }
  });

  it('returns full report structure', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([
      { id: '1', ticketId: 't1', personaType: 'agent-x', status: 'completed', outputSummary: 'x'.repeat(250), retryCount: 0 },
    ]);

    const report = await analyzeAgentCollaboration('proj-1');
    expect(report.projectId).toBe('proj-1');
    expect(report.generatedAt).toBeTruthy();
    expect(Array.isArray(report.agents)).toBe(true);
    expect(typeof report.aiSummary).toBe('string');
    expect(Array.isArray(report.aiRecommendations)).toBe(true);
  });
});
