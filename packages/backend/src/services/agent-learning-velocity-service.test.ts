import { describe, it, expect, vi } from 'vitest';
import { computeTrend, computeLearningPhase, computeVelocityScore } from './agent-learning-velocity-service.js';

vi.mock('../db/connection.js', () => ({ db: { select: vi.fn() } }));
vi.mock('../db/schema.js', () => ({ tickets: {}, agentSessions: {} }));

describe('agent-learning-velocity-service', () => {
  it('computeTrend returns improving when delta >= 10', () => {
    expect(computeTrend(10)).toBe('improving');
    expect(computeTrend(20)).toBe('improving');
  });

  it('computeTrend returns regressing when delta <= -10', () => {
    expect(computeTrend(-10)).toBe('regressing');
    expect(computeTrend(-20)).toBe('regressing');
  });

  it('computeTrend returns stable when -10 < delta < 10', () => {
    expect(computeTrend(0)).toBe('stable');
    expect(computeTrend(5)).toBe('stable');
    expect(computeTrend(-5)).toBe('stable');
  });

  it('computeLearningPhase: expert >= 75, proficient >= 50, learning >= 25, novice < 25', () => {
    expect(computeLearningPhase(75)).toBe('expert');
    expect(computeLearningPhase(50)).toBe('proficient');
    expect(computeLearningPhase(25)).toBe('learning');
    expect(computeLearningPhase(10)).toBe('novice');
  });

  it('computeVelocityScore uses 60/40 weight formula', () => {
    // delta=0, recentSuccessRate=100
    // deltaComponent = (0+100)/2 * 0.60 = 50*0.6 = 30
    // recentComponent = 100*0.40 = 40
    // total = 70
    expect(computeVelocityScore(0, 100)).toBe(70);
  });

  it('computeVelocityScore clamps at 100', () => {
    expect(computeVelocityScore(100, 100)).toBe(100);
  });

  it('computeVelocityScore: improving delta boosts score', () => {
    // delta=50, recent=80
    // deltaComponent = (50+100)/2 * 0.60 = 75*0.6 = 45
    // recentComponent = 80*0.40 = 32
    // total = 77
    expect(computeVelocityScore(50, 80)).toBe(77);
  });

  it('computeVelocityScore: negative delta reduces score', () => {
    // delta=-50, recent=40
    // deltaComponent = max(0, (-50+100)/2) * 0.60 = 25*0.6 = 15
    // recentComponent = 40*0.40 = 16
    // total = 31
    expect(computeVelocityScore(-50, 40)).toBe(31);
  });
});
