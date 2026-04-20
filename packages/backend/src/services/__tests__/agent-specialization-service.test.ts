import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeSpecializationScore,
  getSpecializationTier,
  analyzeAgentSpecialization,
} from '../agent-specialization-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"aiSummary":"Test summary","aiRecommendations":["Rec1"]}' }],
      }),
    };
  },
}));

import { db } from '../../db/connection.js';

const NOW = Date.now();
function makeTicket(id: string, persona: string, labels: string[]) {
  return { id, assignedPersona: persona, status: 'done', labels };
}

describe('computeSpecializationScore', () => {
  it('returns base inDomainRate for normal sample', () => {
    expect(computeSpecializationScore(70, 10)).toBe(70);
  });

  it('adds volume bonus for totalTasks >= 20', () => {
    expect(computeSpecializationScore(70, 20)).toBe(75);
  });

  it('subtracts low sample penalty for totalTasks < 5', () => {
    expect(computeSpecializationScore(70, 3)).toBe(60);
  });

  it('clamps to 100 max', () => {
    expect(computeSpecializationScore(100, 20)).toBe(100);
  });

  it('clamps to 0 min', () => {
    expect(computeSpecializationScore(0, 3)).toBe(0);
  });
});

describe('getSpecializationTier', () => {
  it('returns highly-specialized for score >= 80', () => {
    expect(getSpecializationTier(80)).toBe('highly-specialized');
    expect(getSpecializationTier(100)).toBe('highly-specialized');
  });

  it('returns focused for score >= 60', () => {
    expect(getSpecializationTier(60)).toBe('focused');
    expect(getSpecializationTier(79)).toBe('focused');
  });

  it('returns generalist for score >= 40', () => {
    expect(getSpecializationTier(40)).toBe('generalist');
    expect(getSpecializationTier(59)).toBe('generalist');
  });

  it('returns unfocused for score < 40', () => {
    expect(getSpecializationTier(39)).toBe('unfocused');
    expect(getSpecializationTier(0)).toBe('unfocused');
  });
});

describe('analyzeAgentSpecialization', () => {
  beforeEach(() => {
    vi.mocked(db.where).mockResolvedValue([]);
  });

  it('returns empty report for no tickets', async () => {
    vi.mocked(db.where).mockResolvedValue([]);
    const report = await analyzeAgentSpecialization('proj1');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('identifies mostSpecializedAgent as highest score agent', async () => {
    const data = [
      makeTicket('t1', 'AgentA', ['backend', 'backend', 'backend']),
      makeTicket('t2', 'AgentA', ['backend']),
      makeTicket('t3', 'AgentB', ['frontend']),
      makeTicket('t4', 'AgentB', ['backend']),
    ];
    vi.mocked(db.where).mockResolvedValue(data);
    const report = await analyzeAgentSpecialization('proj1');
    // AgentA: 2/2 backend = 100% in-domain; AgentB: 1/2 = 50%
    expect(report.summary.mostSpecializedAgent).toBe('AgentA');
  });

  it('counts highlySpecializedCount correctly', async () => {
    const data = [
      makeTicket('t1', 'AgentA', ['backend']),
      makeTicket('t2', 'AgentA', ['backend']),
      makeTicket('t3', 'AgentA', ['backend']),
      makeTicket('t4', 'AgentB', ['frontend']),
      makeTicket('t5', 'AgentB', ['backend']),
    ];
    vi.mocked(db.where).mockResolvedValue(data);
    const report = await analyzeAgentSpecialization('proj1');
    const highlySpecialized = report.agents.filter(a => a.specializationTier === 'highly-specialized');
    expect(report.summary.highlySpecializedCount).toBe(highlySpecialized.length);
  });

  it('report has correct structure fields', async () => {
    const data = [makeTicket('t1', 'AgentA', ['backend'])];
    vi.mocked(db.where).mockResolvedValue(data);
    const report = await analyzeAgentSpecialization('proj1');
    expect(report).toHaveProperty('projectId');
    expect(report).toHaveProperty('generatedAt');
    expect(report).toHaveProperty('summary');
    expect(report).toHaveProperty('agents');
    expect(report).toHaveProperty('aiSummary');
    expect(report).toHaveProperty('aiRecommendations');
  });
});
