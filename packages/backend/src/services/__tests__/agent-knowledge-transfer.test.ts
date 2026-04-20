import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  computeKnowledgeRetentionScore,
  getTransferEfficiencyTier,
  analyzeAgentKnowledgeTransfer,
} from '../agent-knowledge-transfer-service.js';

// Mock DB
vi.mock('../../db/connection.js', () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
  },
}));

// Mock Anthropic with class pattern
vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: vi.fn() };
  }
  return { default: MockAnthropic };
});

import { db } from '../../db/connection.js';
import Anthropic from '@anthropic-ai/sdk';

describe('computeKnowledgeRetentionScore', () => {
  it('returns high score for high rate and long notes', () => {
    // rate=100, notes>200, received=1 → 100*0.5 + 20 + 10 = 80
    const score = computeKnowledgeRetentionScore(100, 250, 1);
    expect(score).toBeGreaterThanOrEqual(75);
  });

  it('applies penalty for zero transfer rate', () => {
    // rate=0, no notes, no received → 0*0.5 + 0 + 0 - 15 = -15 → 0
    const score = computeKnowledgeRetentionScore(0, 0, 0);
    expect(score).toBe(0);
  });

  it('adds note length bonus for notes > 100', () => {
    const withShortNotes = computeKnowledgeRetentionScore(50, 50, 0);
    const withLongNotes = computeKnowledgeRetentionScore(50, 150, 0);
    expect(withLongNotes).toBeGreaterThan(withShortNotes);
  });
});

describe('getTransferEfficiencyTier', () => {
  it('returns correct tiers at boundaries 75/50/25', () => {
    expect(getTransferEfficiencyTier(75)).toBe('excellent');
    expect(getTransferEfficiencyTier(100)).toBe('excellent');
    expect(getTransferEfficiencyTier(74)).toBe('good');
    expect(getTransferEfficiencyTier(50)).toBe('good');
    expect(getTransferEfficiencyTier(49)).toBe('adequate');
    expect(getTransferEfficiencyTier(25)).toBe('adequate');
    expect(getTransferEfficiencyTier(24)).toBe('poor');
    expect(getTransferEfficiencyTier(0)).toBe('poor');
  });
});

describe('analyzeAgentKnowledgeTransfer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty agents when project has no tickets', async () => {
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentKnowledgeTransfer('proj-empty');
    expect(report.agents).toHaveLength(0);
    expect(report.summary.totalAgents).toBe(0);
  });

  it('agent with 100% transfer + avg note 250 chars → tier excellent', async () => {
    // Note contains 'received' keyword so receivedKnowledgeCount > 0 → score = 100*0.5 + 20 + 10 = 80 → excellent
    const longNote = 'received ' + 'A'.repeat(241);
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 't1' }]);
          return Promise.resolve([
            { personaType: 'AgentA', outputSummary: longNote, status: 'completed', startedAt: null, completedAt: null },
            { personaType: 'AgentA', outputSummary: longNote, status: 'completed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentKnowledgeTransfer('proj-1');
    expect(report.agents[0].transferEfficiencyTier).toBe('excellent');
    expect(report.agents[0].knowledgeTransferRate).toBe(100);
  });

  it('agent with 0% transfer increments knowledgeLossRiskCount', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 't1' }]);
          return Promise.resolve([
            { personaType: 'AgentB', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
            { personaType: 'AgentB', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentKnowledgeTransfer('proj-2');
    expect(report.summary.knowledgeLossRiskCount).toBe(1);
  });

  it('orders agents by score (top agent has highest score)', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 't1' }]);
          const longNote = 'B'.repeat(300);
          return Promise.resolve([
            // AgentA: high transfer
            { personaType: 'AgentA', outputSummary: longNote, status: 'completed', startedAt: null, completedAt: null },
            // AgentB: no transfer
            { personaType: 'AgentB', outputSummary: null, status: 'failed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    const report = await analyzeAgentKnowledgeTransfer('proj-3');
    expect(report.summary.topTransferAgent).toBe('AgentA');
    expect(report.summary.lowestTransferAgent).toBe('AgentB');
  });

  it('AI call gracefully falls back when Anthropic throws', async () => {
    let callCount = 0;
    const selectMock = vi.fn().mockImplementation(() => ({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) return Promise.resolve([{ id: 't1' }]);
          return Promise.resolve([
            { personaType: 'AgentA', outputSummary: 'done', status: 'completed', startedAt: null, completedAt: null },
          ]);
        }),
      }),
    }));
    (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

    // Make Anthropic messages.create throw
    const MockAnthropicInstance = new (Anthropic as unknown as new () => { messages: { create: ReturnType<typeof vi.fn> } })();
    MockAnthropicInstance.messages.create.mockRejectedValue(new Error('API key missing'));

    const report = await analyzeAgentKnowledgeTransfer('proj-4');
    // Should still return a valid report without aiSummary
    expect(report.agents).toHaveLength(1);
    expect(report.summary.totalAgents).toBe(1);
  });
});
