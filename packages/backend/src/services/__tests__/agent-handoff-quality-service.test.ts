import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeHandoffScore, getHandoffTier, analyzeAgentHandoffQuality } from '../agent-handoff-quality-service.js';

describe('computeHandoffScore', () => {
  it('computes base from three averages', () => {
    // base = (60+60+60)/3 = 60, penalty = 0*0.3 = 0 → 60
    expect(computeHandoffScore(60, 60, 60, 0)).toBe(60);
  });

  it('applies follow-up penalty', () => {
    // base = (80+80+80)/3 = 80, penalty = 20*0.3 = 6 → 74
    expect(computeHandoffScore(80, 80, 80, 20)).toBe(74);
  });

  it('clamps to 0 at minimum', () => {
    expect(computeHandoffScore(0, 0, 0, 100)).toBe(0);
  });

  it('clamps to 100 at maximum', () => {
    expect(computeHandoffScore(100, 100, 100, 0)).toBe(100);
  });
});

describe('getHandoffTier', () => {
  it('returns exemplary for score >= 80', () => {
    expect(getHandoffTier(80)).toBe('exemplary');
    expect(getHandoffTier(100)).toBe('exemplary');
  });

  it('returns proficient for score >= 60', () => {
    expect(getHandoffTier(60)).toBe('proficient');
    expect(getHandoffTier(79)).toBe('proficient');
  });

  it('returns adequate for score >= 40', () => {
    expect(getHandoffTier(40)).toBe('adequate');
    expect(getHandoffTier(59)).toBe('adequate');
  });

  it('returns deficient for score < 40', () => {
    expect(getHandoffTier(39)).toBe('deficient');
    expect(getHandoffTier(0)).toBe('deficient');
  });
});

// Mock DB
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
        content: [{ type: 'text', text: '{"insights": ["Test insight"], "recommendations": ["Test rec"]}' }],
      }),
    };
  },
}));

describe('analyzeAgentHandoffQuality', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('returns empty report when no handoffs', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([]);

    const report = await analyzeAgentHandoffQuality('proj-1');
    expect(report.projectId).toBe('proj-1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.avgHandoffScore).toBe(0);
  });

  it('builds agent metrics from handoff rows', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([
      { id: '1', ticketId: 't1', content: 'handoff context with next steps and status update here for testing', handoffFrom: 'agent-a', handoffTo: 'agent-b', createdAt: new Date() },
      { id: '2', ticketId: 't2', content: 'short', handoffFrom: 'agent-a', handoffTo: null, createdAt: new Date() },
    ]);

    const report = await analyzeAgentHandoffQuality('proj-1');
    expect(report.agents).toHaveLength(1);
    expect(report.agents[0].agentId).toBe('agent-a');
    expect(report.agents[0].totalHandoffs).toBe(2);
    expect(report.summary.totalAgents).toBe(1);
  });

  it('sets handoffTier on each agent', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([
      { id: '1', ticketId: 't1', content: 'x'.repeat(300) + ' context status next todo complete done', handoffFrom: 'high-agent', handoffTo: 'b', createdAt: new Date() },
    ]);

    const report = await analyzeAgentHandoffQuality('proj-1');
    expect(['exemplary', 'proficient', 'adequate', 'deficient']).toContain(report.agents[0].handoffTier);
  });

  it('populates report structure fields', async () => {
    const { db } = await import('../../db/connection.js');
    (db.where as any).mockResolvedValue([
      { id: '1', ticketId: 't1', content: 'context handoff status next', handoffFrom: 'agent-x', handoffTo: 'agent-y', createdAt: new Date() },
    ]);

    const report = await analyzeAgentHandoffQuality('proj-1');
    expect(report.projectId).toBe('proj-1');
    expect(report.generatedAt).toBeTruthy();
    expect(report.summary.bestHandoffAgent).toBeTruthy();
    expect(report.summary.worstHandoffAgent).toBeTruthy();
    expect(typeof report.summary.highQualityHandoffCount).toBe('number');
    expect(Array.isArray(report.insights)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });
});
