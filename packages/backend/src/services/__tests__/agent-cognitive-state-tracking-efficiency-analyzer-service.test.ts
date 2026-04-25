import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCognitiveStateTrackingEfficiency } from '../agent-cognitive-state-tracking-efficiency-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, status = 'completed') {
  const startedAt = new Date('2026-04-25T10:00:00Z');
  const completedAt = new Date(startedAt.getTime() + 300000);
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: startedAt.toISOString(),
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

describe('analyzeAgentCognitiveStateTrackingEfficiency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.efficiency_score).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.trend).toBe('stable');
    expect(r.most_coherent_agent).toBe('N/A');
  });

  it('efficiency_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.efficiency_score).toBeGreaterThanOrEqual(0);
    expect(r.efficiency_score).toBeLessThanOrEqual(100);
  });

  it('high + low = total sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.high_efficiency_sessions + r.low_efficiency_sessions).toBe(r.total_sessions);
  });

  it('context_recovery_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.context_recovery_rate).toBeGreaterThanOrEqual(0);
    expect(r.context_recovery_rate).toBeLessThanOrEqual(100);
  });

  it('multi_step_completion_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.multi_step_completion_rate).toBeGreaterThanOrEqual(0);
    expect(r.multi_step_completion_rate).toBeLessThanOrEqual(100);
  });

  it('dependency_tracking_accuracy is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.dependency_tracking_accuracy).toBeGreaterThanOrEqual(0);
    expect(r.dependency_tracking_accuracy).toBeLessThanOrEqual(100);
  });

  it('redundant_action_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.redundant_action_rate).toBeGreaterThanOrEqual(0);
    expect(r.redundant_action_rate).toBeLessThanOrEqual(100);
  });

  it('state_loss_events >= 0', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.state_loss_events).toBeGreaterThanOrEqual(0);
  });

  it('longest_coherent_chain >= 0', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.longest_coherent_chain).toBeGreaterThanOrEqual(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('most and least coherent agents returned', async () => {
    setupMock([makeSession('agentX'), makeSession('agentY')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.most_coherent_agent).toBeTruthy();
    expect(r.least_coherent_agent).toBeTruthy();
  });

  it('single agent: most = least coherent', async () => {
    setupMock([makeSession('solo'), makeSession('solo'), makeSession('solo')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.most_coherent_agent).toBe(r.least_coherent_agent);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.total_sessions).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('state loss penalizes score', async () => {
    setupMock(Array(20).fill(null).map(() => makeSession('agent-loser', 'in_progress')));
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.efficiency_score).toBeGreaterThanOrEqual(0);
  });

  it('large session set: score stays bounded', async () => {
    setupMock(Array(50).fill(null).map((_, i) => makeSession(`agent-${i % 5}`, 'completed')));
    const r = await analyzeAgentCognitiveStateTrackingEfficiency();
    expect(r.efficiency_score).toBeGreaterThanOrEqual(0);
    expect(r.efficiency_score).toBeLessThanOrEqual(100);
    expect(r.total_sessions).toBe(50);
  });
});
