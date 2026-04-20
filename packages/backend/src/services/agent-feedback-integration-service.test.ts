import { describe, it, expect, vi } from 'vitest';
import {
  computeFeedbackIntegrationScore,
  getResponsivenessTier,
  analyzeAgentFeedbackIntegration,
} from './agent-feedback-integration-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}

function mockDb(results: unknown[][]) {
  let call = 0;
  (db as any).select.mockImplementation(() => {
    const data = results[call] ?? [];
    call++;
    return makeSelectChain(data);
  });
}

describe('analyzeAgentFeedbackIntegration', () => {
  it('empty project returns report with null agents', async () => {
    mockDb([[]]);
    const result = await analyzeAgentFeedbackIntegration('proj-empty');
    expect(result.agents).toHaveLength(0);
    expect(result.summary.topResponsiveAgent).toBeNull();
    expect(result.summary.leastResponsiveAgent).toBeNull();
  });

  it('computeFeedbackIntegrationScore base formula (no time bonus/penalty)', () => {
    const score = computeFeedbackIntegrationScore(10, 8, 5);
    expect(score).toBe(80);
  });

  it('fast response bonus: avgResponseTimeHours < 2 → +10', () => {
    const score = computeFeedbackIntegrationScore(10, 8, 1);
    expect(score).toBe(90);
  });

  it('slow response penalty: avgResponseTimeHours > 24 → -15', () => {
    const score = computeFeedbackIntegrationScore(10, 8, 30);
    expect(score).toBe(65);
  });

  it('no feedback received → score 50', () => {
    const score = computeFeedbackIntegrationScore(0, 0, 5);
    expect(score).toBe(50);
  });

  it('tier: proactive>=80, responsive>=60, selective>=40, resistant<40', () => {
    expect(getResponsivenessTier(85)).toBe('proactive');
    expect(getResponsivenessTier(65)).toBe('responsive');
    expect(getResponsivenessTier(45)).toBe('selective');
    expect(getResponsivenessTier(30)).toBe('resistant');
  });

  it('avgIntegrationRate is average across all agents', async () => {
    mockDb([
      [{ id: 't1' }, { id: 't2' }],
      [
        { personaType: 'alice', status: 'completed', retryCount: 0, startedAt: new Date('2024-01-01T10:00:00Z'), completedAt: new Date('2024-01-01T10:30:00Z') },
        { personaType: 'alice', status: 'completed', retryCount: 0, startedAt: new Date('2024-01-01T11:00:00Z'), completedAt: new Date('2024-01-01T11:30:00Z') },
        { personaType: 'bob', status: 'failed', retryCount: 1, startedAt: new Date('2024-01-01T10:00:00Z'), completedAt: new Date('2024-01-01T10:30:00Z') },
        { personaType: 'bob', status: 'failed', retryCount: 1, startedAt: new Date('2024-01-01T11:00:00Z'), completedAt: new Date('2024-01-01T11:30:00Z') },
      ],
    ]);
    const result = await analyzeAgentFeedbackIntegration('proj-1');
    expect(result.summary.avgIntegrationRate).toBe(50);
  });

  it('topResponsiveAgent is agent with highest integrationScore', async () => {
    mockDb([
      [{ id: 't1' }],
      [
        { personaType: 'alice', status: 'completed', retryCount: 0, startedAt: new Date('2024-01-01T10:00:00Z'), completedAt: new Date('2024-01-01T10:30:00Z') },
        { personaType: 'alice', status: 'completed', retryCount: 0, startedAt: new Date('2024-01-01T11:00:00Z'), completedAt: new Date('2024-01-01T11:30:00Z') },
        { personaType: 'bob', status: 'failed', retryCount: 2, startedAt: new Date('2024-01-01T10:00:00Z'), completedAt: new Date('2024-01-01T10:30:00Z') },
      ],
    ]);
    const result = await analyzeAgentFeedbackIntegration('proj-1');
    expect(result.summary.topResponsiveAgent).toBe('alice');
  });
});
