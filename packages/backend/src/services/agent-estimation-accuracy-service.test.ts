import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeEstimationScore, getEstimationTier, getEstimationBias, analyzeAgentEstimationAccuracy } from './agent-estimation-accuracy-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text: '{"insights":["a"],"recommendations":["b"]}' }] }) }
  }
}));
import { db } from '../db/connection.js';

function makeSelectChain(data: unknown[]) {
  return { from: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(data) };
}
function mockDbSequence(datasets: unknown[][]) {
  let idx = 0;
  (db as any).select.mockImplementation(() => makeSelectChain(datasets[idx++] ?? []));
}

beforeEach(() => { vi.clearAllMocks(); });

describe('computeEstimationScore', () => {
  it('base: 5/10, error=0 → 50', () => {
    expect(computeEstimationScore(5, 10, 0)).toBe(50);
  });

  it('perfect: 10/10, error=0 → 100', () => {
    expect(computeEstimationScore(10, 10, 0)).toBe(100);
  });

  it('penalty: 10/10, error=100 → 70', () => {
    // base=100, penalty=min(30, 100*0.3)=30 → 100-30=70
    expect(computeEstimationScore(10, 10, 100)).toBe(70);
  });

  it('clamp: 0/5, error=200 → max(0, 0 - 30) = 0', () => {
    // base=0, penalty=min(30, 200*0.3)=30 → 0-30=-30 → clamped to 0
    expect(computeEstimationScore(0, 5, 200)).toBe(0);
  });
});

describe('getEstimationTier', () => {
  it('maps scores to correct tiers', () => {
    expect(getEstimationTier(80)).toBe('precise');
    expect(getEstimationTier(60)).toBe('reasonable');
    expect(getEstimationTier(30)).toBe('unreliable');
    expect(getEstimationTier(20)).toBe('erratic');
  });
});

describe('getEstimationBias', () => {
  it('over=50,under=20 → pessimistic', () => {
    expect(getEstimationBias(50, 20)).toBe('pessimistic');
  });

  it('over=20,under=50 → optimistic', () => {
    expect(getEstimationBias(20, 50)).toBe('optimistic');
  });

  it('over=20,under=20 → accurate', () => {
    expect(getEstimationBias(20, 20)).toBe('accurate');
  });

  it('over=40,under=40 → none', () => {
    expect(getEstimationBias(40, 40)).toBe('none');
  });
});

describe('analyzeAgentEstimationAccuracy', () => {
  it('returns correct shape with required fields', async () => {
    const now = Date.now();
    mockDbSequence([
      [{ id: 't1', assignedPersona: 'alice', status: 'done', storyPoints: 2, createdAt: new Date(now - 86400000), updatedAt: new Date(now) }],
      [{ id: 's1', ticketId: 't1', personaType: 'alice', status: 'completed', startedAt: new Date(now - 86400000), completedAt: new Date(now), retryCount: 0 }],
    ]);
    const result = await analyzeAgentEstimationAccuracy('proj-1');
    expect(result).toHaveProperty('projectId', 'proj-1');
    expect(result).toHaveProperty('generatedAt');
    expect(result.summary).toHaveProperty('totalAgents');
    expect(result.summary).toHaveProperty('avgEstimationScore');
    expect(result.summary).toHaveProperty('mostPreciseAgent');
    expect(result.summary).toHaveProperty('mostErraticAgent');
    expect(result.summary).toHaveProperty('accurateEstimationCount');
    expect(Array.isArray(result.agents)).toBe(true);
    expect(Array.isArray(result.insights)).toBe(true);
    expect(Array.isArray(result.recommendations)).toBe(true);
  });

  it('summary.accurateEstimationCount = count of agents with tier precise or reasonable', async () => {
    const now = Date.now();
    // Two agents: alice has perfect estimation (score high → precise), bob has terrible (score low → erratic)
    mockDbSequence([
      [
        { id: 't1', assignedPersona: 'alice', status: 'done', storyPoints: 2, createdAt: new Date(now - 86400000), updatedAt: new Date(now) },
        { id: 't2', assignedPersona: 'bob', status: 'done', storyPoints: 2, createdAt: new Date(now - 86400000), updatedAt: new Date(now) },
      ],
      [
        // alice: 10 sessions all within range (actual ≈ estimated) → high score
        { id: 's1', ticketId: 't1', personaType: 'alice', status: 'completed', startedAt: new Date(now - 3600000), completedAt: new Date(now), retryCount: 0 },
        // bob: session with huge error (actual >> estimated) → low score
        { id: 's2', ticketId: 't2', personaType: 'bob', status: 'completed', startedAt: new Date(now - 86400000 * 30), completedAt: new Date(now), retryCount: 0 },
      ],
    ]);
    const result = await analyzeAgentEstimationAccuracy('proj-1');
    const countFromTiers = result.agents.filter(a => a.estimationTier === 'precise' || a.estimationTier === 'reasonable').length;
    expect(result.summary.accurateEstimationCount).toBe(countFromTiers);
  });
});
