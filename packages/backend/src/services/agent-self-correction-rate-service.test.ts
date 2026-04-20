import { describe, it, expect } from 'vitest';
import {
  analyzeAgentSelfCorrectionRate,
  type AgentSelfCorrectionReport,
} from './agent-self-correction-rate-service.js';

function makeSession(personaId: string, status: 'completed' | 'failed' | 'running') {
  return { personaId, status };
}

describe('analyzeAgentSelfCorrectionRate', () => {
  it('returns empty report when no sessions', () => {
    const report = analyzeAgentSelfCorrectionRate('proj-1', []);
    expect(report.agents).toEqual([]);
    expect(report.projectAvgCorrectionRate).toBe(0);
    expect(report.topSelfCorrector).toBeNull();
    expect(report.mostErrorProne).toBeNull();
    expect(report.totalCorrections).toBe(0);
  });

  it('counts failed sessions as externallyDetectedErrors', () => {
    const sessions = [
      makeSession('AgentA', 'failed'),
      makeSession('AgentA', 'failed'),
      makeSession('AgentA', 'completed'),
    ];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    const agent = report.agents.find((a) => a.agentId === 'AgentA')!;
    expect(agent.externallyDetectedErrors).toBe(2);
    expect(agent.totalRevisions).toBe(2);
  });

  it('counts failed→completed as selfDetectedError', () => {
    const sessions = [
      makeSession('AgentB', 'failed'),
      makeSession('AgentB', 'completed'),
    ];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    const agent = report.agents.find((a) => a.agentId === 'AgentB')!;
    expect(agent.selfDetectedErrors).toBe(1);
    expect(agent.totalRevisions).toBe(1);
  });

  it('correctionScore = selfDetected/totalRevisions * 100', () => {
    const sessions = [
      makeSession('AgentC', 'failed'),
      makeSession('AgentC', 'completed'), // self-corrected
      makeSession('AgentC', 'failed'),    // not self-corrected (next is not completed)
    ];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    const agent = report.agents.find((a) => a.agentId === 'AgentC')!;
    expect(agent.selfDetectedErrors).toBe(1);
    expect(agent.totalRevisions).toBe(2);
    expect(agent.correctionScore).toBe(50);
  });

  it('tier excellent >= 80', () => {
    // 100% self-correction → excellent
    const sessions = [makeSession('AgentD', 'failed'), makeSession('AgentD', 'completed')];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    const agent = report.agents.find((a) => a.agentId === 'AgentD')!;
    expect(agent.correctionTier).toBe('excellent');
  });

  it('tier struggling < 40', () => {
    // 0% self-correction → struggling
    const sessions = [makeSession('AgentE', 'failed')];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    const agent = report.agents.find((a) => a.agentId === 'AgentE')!;
    expect(agent.correctionTier).toBe('struggling');
  });

  it('topSelfCorrector has highest correctionScore', () => {
    const sessions = [
      makeSession('AgentF', 'failed'), makeSession('AgentF', 'completed'),
      makeSession('AgentG', 'failed'),
    ];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    expect(report.topSelfCorrector).toBe('AgentF');
  });

  it('totalCorrections sums selfDetectedErrors across agents', () => {
    const sessions = [
      makeSession('AgentH', 'failed'), makeSession('AgentH', 'completed'),
      makeSession('AgentI', 'failed'), makeSession('AgentI', 'completed'),
    ];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    expect(report.totalCorrections).toBe(2);
  });

  it('agents with no failures have correctionRate = 0', () => {
    const sessions = [makeSession('AgentJ', 'completed'), makeSession('AgentJ', 'completed')];
    const report = analyzeAgentSelfCorrectionRate('proj-1', sessions);
    const agent = report.agents.find((a) => a.agentId === 'AgentJ')!;
    expect(agent.correctionRate).toBe(0);
    expect(agent.totalRevisions).toBe(0);
  });
});
