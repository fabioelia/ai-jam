export interface AgentSelfCorrectionMetrics {
  agentId: string;
  agentName: string;
  correctionRate: number;
  totalRevisions: number;
  selfDetectedErrors: number;
  externallyDetectedErrors: number;
  correctionScore: number;
  correctionTier: 'excellent' | 'good' | 'improving' | 'struggling';
}

export interface AgentSelfCorrectionReport {
  projectId: string;
  generatedAt: string;
  agents: AgentSelfCorrectionMetrics[];
  projectAvgCorrectionRate: number;
  topSelfCorrector: string | null;
  mostErrorProne: string | null;
  totalCorrections: number;
}

function getCorrectionTier(score: number): AgentSelfCorrectionMetrics['correctionTier'] {
  if (score >= 80) return 'excellent';
  if (score >= 60) return 'good';
  if (score >= 40) return 'improving';
  return 'struggling';
}

export function analyzeAgentSelfCorrectionRate(
  projectId: string,
  sessions: any[],
): AgentSelfCorrectionReport {
  if (sessions.length === 0) {
    return {
      projectId,
      generatedAt: new Date().toISOString(),
      agents: [],
      projectAvgCorrectionRate: 0,
      topSelfCorrector: null,
      mostErrorProne: null,
      totalCorrections: 0,
    };
  }

  // Group sessions by personaId in order
  const agentSessionMap = new Map<string, any[]>();
  for (const s of sessions) {
    const id = s.personaId || s.agentId || 'unknown';
    if (!agentSessionMap.has(id)) agentSessionMap.set(id, []);
    agentSessionMap.get(id)!.push(s);
  }

  const agents: AgentSelfCorrectionMetrics[] = [];

  for (const [agentId, agentSessions] of agentSessionMap.entries()) {
    let totalRevisions = 0;
    let selfDetectedErrors = 0;
    let externallyDetectedErrors = 0;

    // A 'failed' session = externallyDetectedError
    // A 'failed' session followed by a completed session for same agent = selfDetectedError + totalRevision
    for (let i = 0; i < agentSessions.length; i++) {
      const s = agentSessions[i];
      if (s.status === 'failed') {
        externallyDetectedErrors++;
        totalRevisions++;
        // Check if next session is completed (retry that succeeded)
        if (i + 1 < agentSessions.length && agentSessions[i + 1].status === 'completed') {
          selfDetectedErrors++;
        }
      }
    }

    const correctionScore = Math.max(
      0,
      Math.min(100, (selfDetectedErrors / Math.max(totalRevisions, 1)) * 100),
    );

    const correctionRate =
      totalRevisions > 0 ? Math.round((selfDetectedErrors / totalRevisions) * 100) : 0;

    const agentName = agentId.charAt(0).toUpperCase() + agentId.slice(1).replace(/_/g, ' ');

    agents.push({
      agentId,
      agentName,
      correctionRate,
      totalRevisions,
      selfDetectedErrors,
      externallyDetectedErrors,
      correctionScore: Math.round(correctionScore),
      correctionTier: getCorrectionTier(correctionScore),
    });
  }

  const projectAvgCorrectionRate =
    agents.length > 0
      ? Math.round(agents.reduce((s, a) => s + a.correctionRate, 0) / agents.length)
      : 0;

  const topSelfCorrector =
    agents.length > 0
      ? agents.reduce((best, a) => (a.correctionScore > best.correctionScore ? a : best), agents[0])
          .agentName
      : null;

  const mostErrorProne =
    agents.length > 0
      ? agents.reduce(
          (worst, a) => (a.externallyDetectedErrors > worst.externallyDetectedErrors ? a : worst),
          agents[0],
        ).agentName
      : null;

  const totalCorrections = agents.reduce((s, a) => s + a.selfDetectedErrors, 0);

  return {
    projectId,
    generatedAt: new Date().toISOString(),
    agents,
    projectAvgCorrectionRate,
    topSelfCorrector,
    mostErrorProne,
    totalCorrections,
  };
}
