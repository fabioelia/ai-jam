import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentSelfMonitoringRate } from '../agent-self-monitoring-rate-analyzer-service.js';

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

describe('analyzeAgentSelfMonitoringRate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.monitoring_score).toBe(0);
    expect(r.total_sessions).toBe(0);
    expect(r.trend).toBe('stable');
    expect(r.most_self_aware_agent).toBe('N/A');
  });

  it('monitoring_score is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.monitoring_score).toBeGreaterThanOrEqual(0);
    expect(r.monitoring_score).toBeLessThanOrEqual(100);
  });

  it('high + low = total sessions', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c'), makeSession('d')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.high_monitoring_sessions + r.low_monitoring_sessions).toBe(r.total_sessions);
  });

  it('avg_monitoring_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.avg_monitoring_rate).toBeGreaterThanOrEqual(0);
    expect(r.avg_monitoring_rate).toBeLessThanOrEqual(100);
  });

  it('progress_check_frequency is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.progress_check_frequency).toBeGreaterThanOrEqual(0);
    expect(r.progress_check_frequency).toBeLessThanOrEqual(100);
  });

  it('mid_task_correction_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.mid_task_correction_rate).toBeGreaterThanOrEqual(0);
    expect(r.mid_task_correction_rate).toBeLessThanOrEqual(100);
  });

  it('pre_delivery_review_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.pre_delivery_review_rate).toBeGreaterThanOrEqual(0);
    expect(r.pre_delivery_review_rate).toBeLessThanOrEqual(100);
  });

  it('external_correction_avoidance_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.external_correction_avoidance_rate).toBeGreaterThanOrEqual(0);
    expect(r.external_correction_avoidance_rate).toBeLessThanOrEqual(100);
  });

  it('monitoring_overhead_rate is 0–100', async () => {
    setupMock([makeSession('a'), makeSession('b')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.monitoring_overhead_rate).toBeGreaterThanOrEqual(0);
    expect(r.monitoring_overhead_rate).toBeLessThanOrEqual(100);
  });

  it('top_monitoring_patterns is non-empty', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.top_monitoring_patterns.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a'), makeSession('b'), makeSession('c')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('most and least self-aware agents returned', async () => {
    setupMock([makeSession('agentX'), makeSession('agentY')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.most_self_aware_agent).toBeTruthy();
    expect(r.least_self_aware_agent).toBeTruthy();
  });

  it('single agent: most = least self-aware', async () => {
    setupMock([makeSession('solo'), makeSession('solo'), makeSession('solo')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.most_self_aware_agent).toBe(r.least_self_aware_agent);
  });

  it('null agentId handled gracefully', async () => {
    setupMock([{ ...makeSession('a'), agentId: null }]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.total_sessions).toBe(1);
  });

  it('analysis_timestamp is valid ISO string', async () => {
    setupMock([makeSession('a')]);
    const r = await analyzeAgentSelfMonitoringRate();
    expect(() => new Date(r.analysis_timestamp)).not.toThrow();
  });

  it('zero monitoring: all low', async () => {
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.high_monitoring_sessions).toBe(0);
    expect(r.low_monitoring_sessions).toBe(0);
  });

  it('large session set: score stays bounded', async () => {
    setupMock(Array(50).fill(null).map((_, i) => makeSession(`agent-${i % 5}`, 'completed')));
    const r = await analyzeAgentSelfMonitoringRate();
    expect(r.monitoring_score).toBeGreaterThanOrEqual(0);
    expect(r.monitoring_score).toBeLessThanOrEqual(100);
    expect(r.total_sessions).toBe(50);
  });
});
