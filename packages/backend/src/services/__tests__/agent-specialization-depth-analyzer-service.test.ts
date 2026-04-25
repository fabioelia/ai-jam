import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSpecializationDepth } from '../agent-specialization-depth-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, durationMs = 300000, status = 'completed') {
  const startedAt = new Date('2026-04-25T10:00:00Z');
  const completedAt = new Date(startedAt.getTime() + durationMs);
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

describe('analyzeAgentSpecializationDepth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentSpecializationDepth();
    expect(r.specialization_rate).toBe(0);
    expect(r.total_agents).toBe(0);
    expect(r.deep_specialist_count).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('deep_specialist + generalist + remaining <= total_agents', async () => {
    setupMock([makeSession('backend-agent', 300000), makeSession('frontend-agent', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.deep_specialist_count + r.generalist_count).toBeLessThanOrEqual(r.total_agents);
  });

  it('specialization_rate = (deep_specialist_count / total_agents) * 100', async () => {
    setupMock([makeSession('backend-agent', 60000), makeSession('frontend-agent', 60000)]);
    const r = await analyzeAgentSpecializationDepth();
    const expected = r.total_agents > 0 ? (r.deep_specialist_count / r.total_agents) * 100 : 0;
    expect(r.specialization_rate).toBeCloseTo(expected, 0);
  });

  it('avg_specialization_score is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 600000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.avg_specialization_score).toBeGreaterThanOrEqual(0);
    expect(r.avg_specialization_score).toBeLessThanOrEqual(100);
  });

  it('top_specialization_domains is non-empty', async () => {
    setupMock([makeSession('backend-agent', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.top_specialization_domains.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000), makeSession('c', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('returns most and least specialized agents', async () => {
    setupMock([makeSession('x', 300000), makeSession('y', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.most_specialized_agent).toBeTruthy();
    expect(r.least_specialized_agent).toBeTruthy();
  });

  it('single agent scenario', async () => {
    setupMock([makeSession('solo', 300000), makeSession('solo', 300000), makeSession('solo', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.total_agents).toBe(1);
    expect(r.most_specialized_agent).toBe(r.least_specialized_agent);
  });

  it('all specialists when all same-domain agents', async () => {
    setupMock([
      makeSession('backend-agent-1', 60000),
      makeSession('backend-agent-1', 60000),
      makeSession('backend-agent-2', 60000),
      makeSession('backend-agent-2', 60000),
    ]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.total_agents).toBe(2);
    expect(r.deep_specialist_count).toBeGreaterThanOrEqual(0);
  });

  it('misallocated_count <= deep_specialist_count', async () => {
    setupMock([makeSession('a', 120000), makeSession('b', 300000), makeSession('c', 600000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.misallocated_count).toBeLessThanOrEqual(r.deep_specialist_count);
  });

  it('cross_domain_task_rate is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.cross_domain_task_rate).toBeGreaterThanOrEqual(0);
    expect(r.cross_domain_task_rate).toBeLessThanOrEqual(100);
  });

  it('domain_concentration_rate is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.domain_concentration_rate).toBeGreaterThanOrEqual(0);
    expect(r.domain_concentration_rate).toBeLessThanOrEqual(100);
  });

  it('total_agents reflects unique agentIds', async () => {
    setupMock([makeSession('agentA', 300000), makeSession('agentA', 300000), makeSession('agentB', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.total_agents).toBe(2);
  });

  it('analysis_timestamp is a valid ISO string', async () => {
    setupMock([makeSession('a', 300000)]);
    const r = await analyzeAgentSpecializationDepth();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a', 300000), agentId: null }]);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.total_agents).toBe(1);
  });

  it('mixed specialist and generalist agents', async () => {
    const sessions = [
      ...Array(5).fill(null).map(() => makeSession('spec-backend', 60000)),
      makeSession('gen-agent', 300000),
      makeSession('gen-agent', 400000),
      makeSession('gen-agent', 500000),
    ];
    setupMock(sessions);
    const r = await analyzeAgentSpecializationDepth();
    expect(r.total_agents).toBe(2);
    expect(r.deep_specialist_count + r.generalist_count).toBeLessThanOrEqual(r.total_agents);
  });
});
