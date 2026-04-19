import { db } from '../db/connection.js';
import { projects, epics, tickets, features } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface EpicSummary {
  epicId: string;
  epicTitle: string;
  totalTickets: number;
  completionRate: number;   // 0-100
  status: 'not_started' | 'in_progress' | 'complete';
}

export interface ProjectHealthResult {
  projectId: string;
  projectName: string;
  totalTickets: number;
  totalEpics: number;
  healthScore: number;        // 0-100
  riskLevel: 'critical' | 'at_risk' | 'on_track' | 'healthy';
  dimensions: {
    completion: number;
    velocity: number;
    quality: number;
    risk: number;             // higher = more risky
  };
  ticketBreakdown: {
    idea: number;
    backlog: number;
    inProgress: number;
    review: number;
    done: number;
  };
  epicSummaries: EpicSummary[];
  topBlockers: string[];      // ticket titles, max 3
  executiveSummary: string;
  recommendedAction: string;
  analyzedAt: string;
}

function extractJSONFromText(text: string): string | null {
  return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

export async function analyzeProjectHealth(projectId: string): Promise<ProjectHealthResult | null> {
  // 1. Query project
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
  if (projectRows.length === 0) return null;
  const project = projectRows[0];

  // 2. Query all features to find epics
  const projectFeatures = await db.select({ id: features.id }).from(features).where(eq(features.projectId, projectId));
  const featureIds = projectFeatures.map((f) => f.id);

  // 3. Query all epics for projectId (via features)
  let allEpics: (typeof epics.$inferSelect)[] = [];
  if (featureIds.length > 0) {
    const epicPromises = featureIds.map((fId) => db.select().from(epics).where(eq(epics.featureId, fId)));
    const epicArrays = await Promise.all(epicPromises);
    allEpics = epicArrays.flat();
  }

  // 4. Query all tickets for projectId
  const allTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));
  const totalTickets = allTickets.length;
  const totalEpics = allEpics.length;

  // Ticket breakdown by status
  const breakdown = { idea: 0, backlog: 0, inProgress: 0, review: 0, done: 0 };
  for (const t of allTickets) {
    const s = t.status as string;
    if (s === 'done') breakdown.done++;
    else if (s === 'review' || s === 'qa' || s === 'acceptance') breakdown.review++;
    else if (s === 'in_progress') breakdown.inProgress++;
    else if (s === 'backlog') breakdown.backlog++;
    else breakdown.idea++;
  }

  // Early return for empty project
  if (totalTickets === 0 && totalEpics === 0) {
    return {
      projectId,
      projectName: project.name,
      totalTickets: 0,
      totalEpics: 0,
      healthScore: 0,
      riskLevel: 'critical',
      dimensions: { completion: 0, velocity: 0, quality: 0, risk: 0 },
      ticketBreakdown: breakdown,
      epicSummaries: [],
      topBlockers: [],
      executiveSummary: 'AI unavailable — heuristic analysis. HealthScore: 0. RiskLevel: critical.',
      recommendedAction: 'Review top blockers and unstarted epics.',
      analyzedAt: new Date().toISOString(),
    };
  }

  // 5. Compute dimensions
  // completion (0-100): % tickets with status 'done' vs total
  const completion = totalTickets > 0 ? (breakdown.done / totalTickets) * 100 : 0;

  // velocity (0-100): ratio done tickets to (done + in_progress + review) tickets; 0 if no such tickets; cap at 100
  const velocityDenom = breakdown.done + breakdown.inProgress + breakdown.review;
  const velocity = velocityDenom > 0 ? Math.min(100, (breakdown.done / velocityDenom) * 100) : 0;

  // quality (0-100): % tickets with desc.length >= 50 AND storyPoints > 0 AND (desc.includes('AC:') || desc.includes('- [ ]'))
  let qualityCount = 0;
  for (const t of allTickets) {
    const desc = t.description || '';
    const hasLongDesc = desc.length >= 50;
    const hasPoints = (t.storyPoints ?? 0) > 0;
    const hasAC = desc.includes('AC:') || desc.includes('- [ ]');
    if (hasLongDesc && hasPoints && hasAC) qualityCount++;
  }
  const quality = totalTickets > 0 ? (qualityCount / totalTickets) * 100 : 0;

  // risk (0-100): (epicsWith0Tickets/totalEpics * 60) + (oldIdeaTickets/totalTickets * 40)
  // oldIdeaTickets = tickets with status 'idea' older than 7 days
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const oldIdeaTickets = allTickets.filter(
    (t) => (t.status as string) === 'idea' && t.createdAt.getTime() < sevenDaysAgo
  ).length;

  let epicsWithZeroTickets = 0;
  if (totalEpics > 0) {
    for (const epic of allEpics) {
      const epicTicketCount = allTickets.filter((t) => t.epicId === epic.id).length;
      if (epicTicketCount === 0) epicsWithZeroTickets++;
    }
  }

  let risk = 0;
  if (totalEpics > 0 || totalTickets > 0) {
    const epicRiskPart = totalEpics > 0 ? (epicsWithZeroTickets / totalEpics) * 60 : 0;
    const ideaRiskPart = totalTickets > 0 ? (oldIdeaTickets / totalTickets) * 40 : 0;
    risk = Math.min(100, epicRiskPart + ideaRiskPart);
  }

  // 6. HealthScore = completion*0.35 + velocity*0.25 + quality*0.25 + (100-risk)*0.15
  const healthScore = Math.round(completion * 0.35 + velocity * 0.25 + quality * 0.25 + (100 - risk) * 0.15);

  // 7. riskLevel
  let riskLevel: ProjectHealthResult['riskLevel'];
  if (healthScore >= 85) riskLevel = 'healthy';
  else if (healthScore >= 65) riskLevel = 'on_track';
  else if (healthScore >= 40) riskLevel = 'at_risk';
  else riskLevel = 'critical';

  // 8. topBlockers
  const blockerTickets = allTickets.filter((t) => (t.description || '').toLowerCase().includes('blocked'));
  const topBlockers = blockerTickets.slice(0, 3).map((t) => t.title);

  // 9. epicSummaries
  const epicSummaries: EpicSummary[] = allEpics.map((epic) => {
    const epicTickets = allTickets.filter((t) => t.epicId === epic.id);
    const epicTotalTickets = epicTickets.length;
    const epicDoneTickets = epicTickets.filter((t) => (t.status as string) === 'done').length;
    const completionRate = epicTotalTickets > 0 ? (epicDoneTickets / epicTotalTickets) * 100 : 0;
    let status: EpicSummary['status'];
    if (completionRate === 100) status = 'complete';
    else if (epicTotalTickets === 0) status = 'not_started';
    else status = 'in_progress';
    return {
      epicId: epic.id,
      epicTitle: epic.title,
      totalTickets: epicTotalTickets,
      completionRate: Math.round(completionRate),
      status,
    };
  });

  // 10. AI call
  let executiveSummary = '';
  let recommendedAction = '';
  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const epicBreakdown = epicSummaries.map((e) => `${e.epicTitle}: ${e.completionRate}% complete (${e.status})`).join(', ') || 'No epics';
    const prompt = `Project health analysis:
- Project: "${project.name}"
- Health Score: ${healthScore}/100
- Risk Level: ${riskLevel}
- Dimensions: completion=${Math.round(completion)}, velocity=${Math.round(velocity)}, quality=${Math.round(quality)}, risk=${Math.round(risk)}
- Tickets: ${totalTickets} total, ${breakdown.done} done, ${breakdown.inProgress} in progress, ${breakdown.review} review, ${breakdown.backlog} backlog, ${breakdown.idea} idea
- Epics: ${totalEpics} total — ${epicBreakdown}
- Top blockers: ${topBlockers.length > 0 ? topBlockers.join(', ') : 'none'}

Return ONLY JSON:
{"executiveSummary": "<2-3 sentence executive summary>", "recommendedAction": "<single recommended action>"}
`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonText = extractJSONFromText(content);
    if (jsonText) {
      const parsed = JSON.parse(jsonText) as { executiveSummary: string; recommendedAction: string };
      executiveSummary = parsed.executiveSummary || '';
      recommendedAction = parsed.recommendedAction || '';
    }
  } catch (e) {
    console.warn('Project health AI failed:', e);
    executiveSummary = `AI unavailable — heuristic analysis. HealthScore: ${healthScore}. RiskLevel: ${riskLevel}.`;
    recommendedAction = 'Review top blockers and unstarted epics.';
  }

  return {
    projectId,
    projectName: project.name,
    totalTickets,
    totalEpics,
    healthScore,
    riskLevel,
    dimensions: {
      completion: Math.round(completion),
      velocity: Math.round(velocity),
      quality: Math.round(quality),
      risk: Math.round(risk),
    },
    ticketBreakdown: breakdown,
    epicSummaries,
    topBlockers,
    executiveSummary,
    recommendedAction,
    analyzedAt: new Date().toISOString(),
  };
}
