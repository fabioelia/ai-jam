import { describe, it, expect } from 'vitest';
import { analyzeAgentCommunicationPatterns } from './agent-communication-pattern-service.js';

function makeSession(personaId: string, handoffTo?: string, createdAt?: string) {
  return {
    personaId,
    handoffTo: handoffTo ?? null,
    createdAt: createdAt ?? '2026-01-01T00:00:00Z',
  };
}

describe('analyzeAgentCommunicationPatterns', () => {
  it('returns correct report structure', () => {
    const sessions = [makeSession('agentA', 'agentB'), makeSession('agentB', 'agentC')];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    expect(report.projectId).toBe('proj-1');
    expect(report.generatedAt).toBeDefined();
    expect(report.summary).toBeDefined();
    expect(Array.isArray(report.agents)).toBe(true);
    expect(Array.isArray(report.insights)).toBe(true);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('calculates messagesSent and messagesReceived correctly', () => {
    const sessions = [
      makeSession('agentA', 'agentB'),
      makeSession('agentA', 'agentC'),
    ];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    const agentA = report.agents.find((a) => a.agentId === 'agentA');
    const agentB = report.agents.find((a) => a.agentId === 'agentB');
    expect(agentA?.messagesSent).toBe(2);
    expect(agentA?.messagesReceived).toBe(0);
    expect(agentB?.messagesReceived).toBe(1);
  });

  it('assigns hub role when uniquePartners >= 4 AND totalMessages >= 10', () => {
    // agentA sends to 5 different agents (5 sent) and receives from 5 agents (5 received)
    const sessions = [
      makeSession('agentA', 'agentB'),
      makeSession('agentA', 'agentC'),
      makeSession('agentA', 'agentD'),
      makeSession('agentA', 'agentE'),
      makeSession('agentA', 'agentF'),
      makeSession('agentB', 'agentA'),
      makeSession('agentC', 'agentA'),
      makeSession('agentD', 'agentA'),
      makeSession('agentE', 'agentA'),
      makeSession('agentF', 'agentA'),
    ];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    const agentA = report.agents.find((a) => a.agentId === 'agentA');
    expect(agentA?.communicationRole).toBe('hub');
  });

  it('assigns relay role when uniquePartners >= 2 AND totalMessages >= 5 (not hub)', () => {
    // agentA sends to 2 agents and receives from 1 — not hub, but relay
    const sessions = [
      makeSession('agentA', 'agentB'),
      makeSession('agentA', 'agentC'),
      makeSession('agentA', 'agentB'),
      makeSession('agentX', 'agentA'),
      makeSession('agentA', 'agentC'),
    ];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    const agentA = report.agents.find((a) => a.agentId === 'agentA');
    expect(agentA?.totalMessages).toBeGreaterThanOrEqual(5);
    expect(agentA?.uniquePartners).toBeGreaterThanOrEqual(2);
    expect(agentA?.communicationRole).toBe('relay');
  });

  it('assigns leaf role when uniquePartners >= 1 AND totalMessages > 0 (not hub/relay)', () => {
    const sessions = [makeSession('agentA', 'agentB')];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    const agentA = report.agents.find((a) => a.agentId === 'agentA');
    expect(agentA?.communicationRole).toBe('leaf');
  });

  it('assigns isolated when totalMessages === 0', () => {
    // agentA has no handoffs, just listed as session owner
    const sessions = [{ personaId: 'agentA', handoffTo: null, createdAt: '2026-01-01T00:00:00Z' }];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    const agentA = report.agents.find((a) => a.agentId === 'agentA');
    expect(agentA?.communicationRole).toBe('isolated');
    expect(agentA?.totalMessages).toBe(0);
  });

  it('applies bottleneckScore bonus +15 when uniquePartners >= 4', () => {
    // Agent with 4+ partners should get +15 bonus
    const sessions = [
      makeSession('agentX', 'agentA'),
      makeSession('agentX', 'agentB'),
      makeSession('agentX', 'agentC'),
      makeSession('agentX', 'agentD'),
      makeSession('agentX', 'agentE'),
    ];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    const agentX = report.agents.find((a) => a.agentId === 'agentX');
    expect(agentX?.uniquePartners).toBeGreaterThanOrEqual(4);
    // base = (0/5)*100 = 0, +15 for 4+ partners, avg latency=1000ms (no +10 penalty)
    expect(agentX?.bottleneckScore).toBe(15);
  });

  it('applies bottleneckScore penalty -10 when avgResponseLatencyMs < 500', () => {
    // agentB receives from agentA with fast latency
    const sessions = [
      makeSession('agentA', 'agentB', '2026-01-01T00:00:00Z'),
      makeSession('agentB', 'agentC', '2026-01-01T00:00:00.100Z'), // 100ms later
    ];
    const report = analyzeAgentCommunicationPatterns('proj-1', sessions);
    const agentB = report.agents.find((a) => a.agentId === 'agentB');
    // agentB has latency of 100ms → penalty -10
    expect(agentB?.avgResponseLatencyMs).toBeLessThan(500);
    // base = (1/2)*100 = 50, -10 for fast latency = 40
    expect(agentB?.bottleneckScore).toBe(40);
  });

  it('returns empty report for empty sessions', () => {
    const report = analyzeAgentCommunicationPatterns('proj-1', []);
    expect(report.agents).toEqual([]);
    expect(report.summary.totalAgents).toBe(0);
    expect(report.summary.totalMessages).toBe(0);
  });
});
