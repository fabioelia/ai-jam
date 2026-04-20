import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeEstimationAccuracy } from './agent-estimation-accuracy-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"aiSummary":"estimation analyzed"}' }] }) },
  })),
}));

import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}
function mockDb(data: unknown[]) {
  (db as any).select.mockImplementation(() => makeSelectChain(data));
}
function makeTicket(id: string, assignedPersona: string | null, status: string, storyPoints: number | null, cycleHours = 24) {
  const now = new Date();
  return {
    id,
    assignedPersona,
    status,
    storyPoints,
    createdAt: new Date(now.getTime() - cycleHours * 60 * 60 * 1000),
    updatedAt: now,
  };
}

beforeEach(() => { vi.clearAllMocks(); });

describe('analyzeEstimationAccuracy', () => {
  it('returns empty when no done tickets with story points', async () => {
    mockDb([
      makeTicket('t1', 'alice', 'in_progress', 5),
      makeTicket('t2', 'alice', 'done', null),
    ]);
    const result = await analyzeEstimationAccuracy('proj-1');
    expect(result.agents).toHaveLength(0);
    expect(result.ticketsAnalyzed).toBe(0);
    expect(result.baselineHoursPerPoint).toBe(0);
  });

  it('computes baselineHoursPerPoint = totalHours / totalPoints', async () => {
    // 2 done tickets: 24h cycle, 2 points each → 48h total / 4 points = 12 h/point
    mockDb([
      makeTicket('t1', 'alice', 'done', 2, 24),
      makeTicket('t2', 'alice', 'done', 2, 24),
    ]);
    const result = await analyzeEstimationAccuracy('proj-1');
    expect(result.baselineHoursPerPoint).toBe(12);
  });

  it('computes accuracyScore = max(0, 100 - |actual-estimated|/max(1,estimated)*100)', async () => {
    // baseline = 24h / 2pts = 12 h/pt; estimated = 2 * 12 = 24h; actual = 24h → accuracy = 100
    mockDb([makeTicket('t1', 'alice', 'done', 2, 24)]);
    const result = await analyzeEstimationAccuracy('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.avgAccuracyScore).toBe(100);
  });

  it('bias overestimator when actualHours > estimatedHours by >20%', async () => {
    // base-agent has short cycle → sets low baseline; alice has much longer actual
    // baseline = (10+100)/(2+2) = 27.5h/pt; alice est=55h, actual=100h → dev=81% → overestimator
    mockDb([
      makeTicket('t1', 'base-agent', 'done', 2, 10),  // short cycle sets low baseline
      makeTicket('t2', 'alice', 'done', 2, 100),       // actual much higher than estimated
    ]);
    const result = await analyzeEstimationAccuracy('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.bias).toBe('overestimator');
  });

  it('bias underestimator when actualHours < estimatedHours by >20%', async () => {
    // Two tickets: baseline = (48+24)/4 = 18h/pt. alice ticket2: 2pts est=36h, actual=24h → dev=(24-36)/36*100 ≈ -33% < -20 → underestimator
    // Simplify: use single agent with actual much less than estimated
    // ticket: 2pts, 5h cycle → baseline = 5/2 = 2.5h/pt; estimated = 2 * 2.5 = 5h; actual = 5h → accurate (same)
    // Let's use: baseline from other agent's ticket then alice with less hours
    mockDb([
      makeTicket('t1', 'base-agent', 'done', 2, 100), // baseline = 100/2 = 50h/pt
      makeTicket('t2', 'alice', 'done', 2, 10),        // estimated = 2*50=100h, actual=10h → dev=(10-100)/100*100=-90% → underestimator
    ]);
    const result = await analyzeEstimationAccuracy('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.bias).toBe('underestimator');
  });

  it('bias accurate when deviation <= 20%', async () => {
    // cycle=24h, 2pts → baseline=12h/pt; estimated=24h, actual=24h → dev=0 → accurate
    mockDb([makeTicket('t1', 'alice', 'done', 2, 24)]);
    const result = await analyzeEstimationAccuracy('proj-1');
    const alice = result.agents.find(a => a.agentPersona === 'alice');
    expect(alice?.bias).toBe('accurate');
  });

  it('sorts agents by avgAccuracyScore desc', async () => {
    mockDb([
      makeTicket('t1', 'accurate', 'done', 2, 24),  // perfect accuracy
      makeTicket('t2', 'inaccurate', 'done', 2, 200), // bad accuracy
    ]);
    const result = await analyzeEstimationAccuracy('proj-1');
    expect(result.agents[0].agentPersona).toBe('accurate');
  });

  it('mostAccurateAgent is first in sorted array', async () => {
    mockDb([
      makeTicket('t1', 'accurate', 'done', 2, 24),
      makeTicket('t2', 'inaccurate', 'done', 2, 200),
    ]);
    const result = await analyzeEstimationAccuracy('proj-1');
    expect(result.mostAccurateAgent).toBe('accurate');
    expect(result.leastAccurateAgent).toBe('inaccurate');
  });

  it('falls back gracefully when AI fails', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as any;
    Anthropic.mockImplementationOnce(() => ({
      messages: { create: vi.fn().mockRejectedValue(new Error('AI error')) },
    }));
    mockDb([makeTicket('t1', 'alice', 'done', 2, 24)]);
    const result = await analyzeEstimationAccuracy('proj-1');
    expect(result.aiSummary).toBe('Review estimation accuracy to improve story point calibration and sprint planning reliability.');
  });
});
