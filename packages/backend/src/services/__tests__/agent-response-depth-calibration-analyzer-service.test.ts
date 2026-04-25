import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentResponseDepthCalibration } from '../agent-response-depth-calibration-analyzer-service.js';

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

describe('analyzeAgentResponseDepthCalibration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupMock([]);
  });

  it('returns zero-state for empty sessions', async () => {
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.calibration_rate).toBe(0);
    expect(r.total_responses).toBe(0);
    expect(r.well_calibrated_count).toBe(0);
    expect(r.trend).toBe('stable');
  });

  it('calibration_rate + complexity_mismatch_rate = 100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 60000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.calibration_rate + r.complexity_mismatch_rate).toBeCloseTo(100, 1);
  });

  it('well_calibrated_count = short sessions (2–15 min)', async () => {
    // 5 min sessions → well calibrated
    setupMock([makeSession('a', 300000), makeSession('b', 300000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.well_calibrated_count).toBeGreaterThan(0);
  });

  it('over_explained_count > 0 for long sessions (>15 min)', async () => {
    setupMock([makeSession('a', 1200000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.over_explained_count).toBeGreaterThan(0);
  });

  it('under_explained_count > 0 for very short sessions (<2 min)', async () => {
    setupMock([makeSession('a', 60000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.under_explained_count).toBeGreaterThan(0);
  });

  it('total_responses equals session count', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000), makeSession('c', 300000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.total_responses).toBe(3);
  });

  it('avg_depth_score is 0–100', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 600000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.avg_depth_score).toBeGreaterThanOrEqual(0);
    expect(r.avg_depth_score).toBeLessThanOrEqual(100);
  });

  it('includes most_miscalibrated_task_types', async () => {
    setupMock([makeSession('a', 300000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.most_miscalibrated_task_types.length).toBeGreaterThan(0);
  });

  it('trend is one of improving/stable/degrading', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 300000), makeSession('c', 300000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(['improving', 'stable', 'degrading']).toContain(r.trend);
  });

  it('returns highest and lowest calibration agents', async () => {
    setupMock([makeSession('x', 300000), makeSession('y', 300000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.highest_calibration_agent).toBeTruthy();
    expect(r.lowest_calibration_agent).toBeTruthy();
  });

  it('N/A agents when no sessions', async () => {
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.highest_calibration_agent).toBe('N/A');
    expect(r.lowest_calibration_agent).toBe('N/A');
  });

  it('handles null timestamps without throwing', async () => {
    setupMock([{ id: 'x', agentId: 'a', status: 'completed', createdAt: null, startedAt: null, completedAt: null }]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r).toBeTruthy();
  });

  it('returns analysis_timestamp as ISO string', async () => {
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.analysis_timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('handles single session', async () => {
    setupMock([makeSession('solo', 300000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.total_responses).toBe(1);
    expect(r.highest_calibration_agent).toBe('solo');
  });

  it('multiple agents tracked independently', async () => {
    setupMock([
      makeSession('agent-1', 300000),
      makeSession('agent-1', 300000),
      makeSession('agent-2', 1800000),
      makeSession('agent-2', 1800000),
    ]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.highest_calibration_agent).not.toBe(r.lowest_calibration_agent);
  });

  it('over + under + well = total_responses', async () => {
    setupMock([makeSession('a', 300000), makeSession('b', 1200000), makeSession('c', 60000)]);
    const r = await analyzeAgentResponseDepthCalibration();
    expect(r.over_explained_count + r.under_explained_count + r.well_calibrated_count).toBe(r.total_responses);
  });
});
