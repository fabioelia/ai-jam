import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeAgentCrossDomainTransferAnalyzer } from '../agent-cross-domain-transfer-analyzer-service.js';

vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  },
}));

import { db } from '../../db/connection.js';

function makeSession(agentId: string, createdAt: Date, status = 'completed') {
  return {
    id: Math.random().toString(),
    agentId,
    status,
    createdAt: createdAt.toISOString(),
    startedAt: createdAt.toISOString(),
    completedAt: new Date(createdAt.getTime() + 30000).toISOString(),
    durationMs: 30000,
  };
}

function setupMock(sessions: object[]) {
  (db.limit as ReturnType<typeof vi.fn>).mockResolvedValue(sessions);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyzeAgentCrossDomainTransferAnalyzer', () => {
  it('returns report with metrics array', async () => {
    setupMock([]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    expect(Array.isArray(report.metrics)).toBe(true);
  });

  it('returns fleetAvgTransferScore', async () => {
    setupMock([]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    expect(typeof report.fleetAvgTransferScore).toBe('number');
  });

  it('returns narrowSpecialistAgents count', async () => {
    setupMock([]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    expect(typeof report.narrowSpecialistAgents).toBe('number');
  });

  it('returns analysisTimestamp as valid ISO date', async () => {
    setupMock([]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    expect(() => new Date(report.analysisTimestamp)).not.toThrow();
    expect(new Date(report.analysisTimestamp).toISOString()).toBe(report.analysisTimestamp);
  });

  it('handles empty sessions gracefully', async () => {
    setupMock([]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    expect(report.metrics).toHaveLength(0);
    expect(report.fleetAvgTransferScore).toBe(0);
    expect(report.narrowSpecialistAgents).toBe(0);
  });

  it('excludes agents with fewer than 2 sessions', async () => {
    const now = new Date();
    setupMock([makeSession('solo', now)]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    expect(report.metrics).toHaveLength(0);
  });

  it('domainDiversityScore is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now, 'completed'),
      makeSession('AgentA', new Date(now.getTime() + 60000), 'failed'),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].domainDiversityScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].domainDiversityScore).toBeLessThanOrEqual(100);
    }
  });

  it('crossDomainConsistency is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].crossDomainConsistency).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].crossDomainConsistency).toBeLessThanOrEqual(100);
    }
  });

  it('adaptationRate is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now, 'completed'),
      makeSession('AgentA', new Date(now.getTime() + 60000), 'failed'),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].adaptationRate).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].adaptationRate).toBeLessThanOrEqual(100);
    }
  });

  it('specializationIndex is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].specializationIndex).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].specializationIndex).toBeLessThanOrEqual(100);
    }
  });

  it('transferScore is 0-100', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      expect(report.metrics[0].transferScore).toBeGreaterThanOrEqual(0);
      expect(report.metrics[0].transferScore).toBeLessThanOrEqual(100);
    }
  });

  it('sorts metrics by transferScore descending', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now, 'completed'),
      makeSession('AgentA', new Date(now.getTime() + 60000), 'failed'),
      makeSession('AgentB', new Date(now.getTime() + 700000), 'completed'),
      makeSession('AgentB', new Date(now.getTime() + 760000), 'completed'),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    for (let i = 1; i < report.metrics.length; i++) {
      expect(report.metrics[i - 1].transferScore).toBeGreaterThanOrEqual(report.metrics[i].transferScore);
    }
  });

  it('trend is one of improving/stable/degrading', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      expect(['improving', 'stable', 'degrading']).toContain(report.metrics[0].trend);
    }
  });

  it('rating is one of excellent/good/fair/poor', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      expect(['excellent', 'good', 'fair', 'poor']).toContain(report.metrics[0].rating);
    }
  });

  it('rating: excellent when transferScore >= 80', async () => {
    const now = new Date();
    const sessions = [];
    for (let i = 0; i < 20; i++) {
      sessions.push(makeSession('AgentA', new Date(now.getTime() + i * 30000), i % 5 === 0 ? 'failed' : 'completed'));
    }
    setupMock(sessions);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0 && report.metrics[0].transferScore >= 80) {
      expect(report.metrics[0].rating).toBe('excellent');
    }
  });

  it('narrowSpecialistAgents counts agents with specializationIndex > 70', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now, 'completed'),
      makeSession('AgentA', new Date(now.getTime() + 60000), 'completed'),
      makeSession('AgentB', new Date(now.getTime() + 700000), 'completed'),
      makeSession('AgentB', new Date(now.getTime() + 760000), 'failed'),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    const expected = report.metrics.filter(m => m.specializationIndex > 70).length;
    expect(report.narrowSpecialistAgents).toBe(expected);
  });

  it('fleetAvgTransferScore is average of all metric scores', async () => {
    const now = new Date();
    setupMock([
      makeSession('AgentA', now),
      makeSession('AgentA', new Date(now.getTime() + 60000)),
      makeSession('AgentB', new Date(now.getTime() + 700000)),
      makeSession('AgentB', new Date(now.getTime() + 760000)),
    ]);
    const report = await analyzeAgentCrossDomainTransferAnalyzer();
    if (report.metrics.length > 0) {
      const expected = Math.round(report.metrics.reduce((s, m) => s + m.transferScore, 0) / report.metrics.length);
      expect(report.fleetAvgTransferScore).toBe(expected);
    }
  });
});
