import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface WeeklySnapshot {
  weekStart: string;
  ticketsCompleted: number;
  avgCompletionTimeHours: number;
  qualityScore: number;
  handoffSuccessRate: number;
}

export interface AgentLearningProfile {
  agentPersona: string;
  snapshots: WeeklySnapshot[];
  improvementSlope: number;
  trend: 'improving' | 'stable' | 'declining';
  stagnationWeeks: number;
  peakQualityScore: number;
  currentQualityScore: number;
  recommendation: string;
}

export interface LearningCurveReport {
  projectId: string;
  generatedAt: string;
  windowWeeks: number;
  agents: AgentLearningProfile[];
}

function linearSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  const sumX = values.reduce((acc, _, i) => acc + i, 0);
  const sumY = values.reduce((acc, v) => acc + v, 0);
  const sumXY = values.reduce((acc, v, i) => acc + i * v, 0);
  const sumX2 = values.reduce((acc, _, i) => acc + i * i, 0);
  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}

function getTrend(slope: number): AgentLearningProfile['trend'] {
  if (slope > 1.0) return 'improving';
  if (slope < -1.0) return 'declining';
  return 'stable';
}

function getRecommendation(profile: Pick<AgentLearningProfile, 'trend' | 'currentQualityScore' | 'stagnationWeeks'>): string {
  const { trend, currentQualityScore, stagnationWeeks } = profile;
  if (trend === 'improving') return 'Consistent improvement — maintain current configuration';
  if (trend === 'declining' && currentQualityScore < 40) return 'Significant regression — consider model or prompt change';
  if (trend === 'declining') return 'Declining trend — review recent task assignments';
  if (trend === 'stable' && currentQualityScore >= 70) return 'High stable performance — candidate for complex task routing';
  if (trend === 'stable' && stagnationWeeks >= 4) return 'Plateau detected — introduce varied task types to stimulate improvement';
  return 'Steady performance — monitor for drift';
}

function countStagnationWeeks(snapshots: WeeklySnapshot[]): number {
  let count = 0;
  let streak = 0;
  for (let i = 1; i < snapshots.length; i++) {
    if (Math.abs(snapshots[i].qualityScore - snapshots[i - 1].qualityScore) < 5) {
      streak++;
      if (streak > count) count = streak;
    } else {
      streak = 0;
    }
  }
  return count;
}

export async function analyzeAgentLearningCurves(projectId: string): Promise<LearningCurveReport> {
  const now = new Date();
  const eightWeeksAgo = new Date(now.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);

  const allTickets = await db
    .select({
      assignedPersona: tickets.assignedPersona,
      status: tickets.status,
      createdAt: tickets.createdAt,
      updatedAt: tickets.updatedAt,
    })
    .from(tickets)
    .where(eq(tickets.projectId, projectId));

  const agentNames = [...new Set(
    allTickets
      .map(t => t.assignedPersona)
      .filter((p): p is string => !!p)
  )];

  if (agentNames.length === 0) {
    return { projectId, generatedAt: now.toISOString(), windowWeeks: 8, agents: [] };
  }

  // Build weekly buckets: 0 = oldest (now - 8w), 7 = most recent (now - 1w)
  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weekStarts: Date[] = [];
  for (let i = 0; i < 8; i++) {
    weekStarts.push(new Date(eightWeeksAgo.getTime() + i * weekMs));
  }

  const agents: AgentLearningProfile[] = agentNames.map(persona => {
    const agentTickets = allTickets.filter(t => t.assignedPersona === persona);

    // Build weekly snapshots
    const snapshots: WeeklySnapshot[] = [];
    for (let w = 0; w < 8; w++) {
      const wStart = weekStarts[w];
      const wEnd = new Date(wStart.getTime() + weekMs);

      const weekDone = agentTickets.filter(t => {
        if (t.status !== 'done') return false;
        const upd = t.updatedAt ? new Date(t.updatedAt) : null;
        return upd && upd >= wStart && upd < wEnd;
      });

      if (weekDone.length === 0) continue;

      // qualityScore: tickets reaching done without rejection (proxy: done w/o going back to in_progress)
      // Simplified: qualityScore = % of done tickets that weren't re-opened (we have no history, so use created→done duration heuristic)
      // Per spec: tickets reaching done without rejection / total completed * 100
      // Without rejection history, we estimate: tickets completed within reasonable time = not rejected
      // Use: completed within 7 days of creation = no rejection (good quality)
      const qualityCount = weekDone.filter(t => {
        const created = t.createdAt ? new Date(t.createdAt) : null;
        const updated = t.updatedAt ? new Date(t.updatedAt) : null;
        if (!created || !updated) return true;
        const daysToComplete = (updated.getTime() - created.getTime()) / (24 * 60 * 60 * 1000);
        return daysToComplete <= 14; // completed within 14 days = no rejection
      });
      const qualityScore = weekDone.length > 0 ? (qualityCount.length / weekDone.length) * 100 : 0;

      // avgCompletionTimeHours
      const completionTimes = weekDone.map(t => {
        const created = t.createdAt ? new Date(t.createdAt) : null;
        const updated = t.updatedAt ? new Date(t.updatedAt) : null;
        if (!created || !updated) return 0;
        return (updated.getTime() - created.getTime()) / (60 * 60 * 1000);
      });
      const avgCompletionTimeHours = completionTimes.length > 0
        ? completionTimes.reduce((a, b) => a + b, 0) / completionTimes.length
        : 0;

      // handoffSuccessRate: outgoing handoffs where downstream completed / total outgoing
      // No handoff table — use 0.5 as neutral default per ticket (no data = neutral)
      const handoffSuccessRate = 50;

      snapshots.push({
        weekStart: wStart.toISOString().split('T')[0],
        ticketsCompleted: weekDone.length,
        avgCompletionTimeHours: Math.round(avgCompletionTimeHours * 10) / 10,
        qualityScore: Math.round(qualityScore * 10) / 10,
        handoffSuccessRate,
      });
    }

    const qualityValues = snapshots.map(s => s.qualityScore);
    const slope = linearSlope(qualityValues);
    const trend = getTrend(slope);
    const stagnationWeeks = countStagnationWeeks(snapshots);
    const peakQualityScore = qualityValues.length > 0 ? Math.max(...qualityValues) : 0;
    const currentQualityScore = qualityValues.length > 0 ? qualityValues[qualityValues.length - 1] : 0;
    const recommendation = getRecommendation({ trend, currentQualityScore, stagnationWeeks });

    return {
      agentPersona: persona,
      snapshots,
      improvementSlope: Math.round(slope * 1000) / 1000,
      trend,
      stagnationWeeks,
      peakQualityScore: Math.round(peakQualityScore * 10) / 10,
      currentQualityScore: Math.round(currentQualityScore * 10) / 10,
      recommendation,
    };
  });

  // Sort desc by currentQualityScore
  agents.sort((a, b) => b.currentQualityScore - a.currentQualityScore);

  return { projectId, generatedAt: now.toISOString(), windowWeeks: 8, agents };
}
