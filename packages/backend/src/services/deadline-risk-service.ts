import { db } from '../db/connection.js';
import { projects, tickets } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

export interface DeadlineRiskResult {
  projectId: string;
  projectName: string;
  deadlineDate: string;          // ISO date provided by caller
  analyzedAt: string;            // ISO timestamp
  totalTickets: number;
  completedTickets: number;
  remainingTickets: number;
  daysRemaining: number;
  daysElapsed: number;
  velocityPerDay: number;        // completed tickets per day (historical)
  requiredVelocity: number;      // tickets per day needed to hit deadline
  velocityGap: number;           // required - actual (positive = behind)
  projectedCompletionDate: string; // ISO date at current velocity
  willMeetDeadline: boolean;
  riskLevel: 'critical' | 'at_risk' | 'on_track' | 'ahead';
  narrative: string;             // AI-generated prediction with numbers
  recommendations: string[];     // AI-generated, max 2 items
}

function extractJSONFromText(text: string): string | null {
  return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

export async function analyzeDeadlineRisk(projectId: string, deadlineDate: string): Promise<DeadlineRiskResult | null> {
  // 1. Query project
  const projectRows = await db.select().from(projects).where(eq(projects.id, projectId));
  if (projectRows.length === 0) return null;
  const project = projectRows[0];

  // 2. Query all tickets for the project
  const allTickets = await db.select().from(tickets).where(eq(tickets.projectId, projectId));

  const now = new Date();
  const deadline = new Date(deadlineDate);

  // 3. Compute metrics
  const completedTickets = allTickets.filter((t) => (t.status as string) === 'done').length;
  const totalTickets = allTickets.length;
  const remainingTickets = totalTickets - completedTickets;

  const daysRemaining = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // daysElapsed floor to 1 (new projects)
  const daysElapsedRaw = (now.getTime() - project.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const daysElapsed = Math.max(1, daysElapsedRaw);

  // velocityPerDay floor to 0.1 to avoid division by zero
  const velocityPerDay = Math.max(0.1, completedTickets / daysElapsed);

  // 4. Prediction
  const requiredVelocity = remainingTickets / Math.max(daysRemaining, 1);
  const velocityGap = requiredVelocity - velocityPerDay;
  const projectedCompletionDays = remainingTickets / Math.max(velocityPerDay, 0.1);
  const projectedCompletionDate = new Date(now.getTime() + projectedCompletionDays * 86400000).toISOString();
  const willMeetDeadline = projectedCompletionDate <= deadline.toISOString();

  // 5. Risk level
  let riskLevel: DeadlineRiskResult['riskLevel'];
  if (remainingTickets === 0) {
    // Nothing left to do — always ahead
    riskLevel = 'ahead';
  } else if (velocityGap > 2 || daysRemaining < 0) {
    riskLevel = 'critical';
  } else if (velocityGap > 0.5) {
    riskLevel = 'at_risk';
  } else if (velocityGap >= -0.5) {
    riskLevel = 'on_track';
  } else {
    riskLevel = 'ahead';
  }

  // 6. AI call
  let narrative = '';
  let recommendations: string[] = [];

  try {
    const client = new Anthropic({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
    });

    const prompt = `Deadline risk analysis for project "${project.name}":
- Deadline: ${deadlineDate} (${daysRemaining} days remaining)
- Total tickets: ${totalTickets}, Completed: ${completedTickets}, Remaining: ${remainingTickets}
- Current velocity: ${velocityPerDay.toFixed(2)} tickets/day (over ${Math.round(daysElapsed)} days)
- Required velocity to hit deadline: ${requiredVelocity.toFixed(2)} tickets/day
- Velocity gap: ${velocityGap.toFixed(2)} (positive = behind schedule)
- Projected completion date: ${new Date(projectedCompletionDate).toDateString()}
- Risk level: ${riskLevel}
- Will meet deadline: ${willMeetDeadline}

Return ONLY JSON:
{"narrative": "<2-3 sentence prediction narrative with specific numbers>", "recommendations": ["<recommendation 1>", "<recommendation 2>"]}
`;

    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonText = extractJSONFromText(content);
    if (jsonText) {
      const parsed = JSON.parse(jsonText) as { narrative: string; recommendations: string[] };
      narrative = parsed.narrative || '';
      recommendations = (parsed.recommendations || []).slice(0, 2);
    }
  } catch (e) {
    console.warn('Deadline risk AI failed:', e);
    narrative = 'AI unavailable — showing heuristic prediction';
    if (riskLevel === 'critical') {
      recommendations = [
        `Increase daily completion rate from ${velocityPerDay.toFixed(1)} to ${requiredVelocity.toFixed(1)} tickets/day`,
        'Consider reducing scope or extending the deadline',
      ];
    } else if (riskLevel === 'at_risk') {
      recommendations = [
        `Boost velocity from ${velocityPerDay.toFixed(1)} to ${requiredVelocity.toFixed(1)} tickets/day`,
        'Review and unblock any stalled tickets',
      ];
    } else {
      recommendations = ['On track — keep current pace'];
    }
  }

  return {
    projectId,
    projectName: project.name,
    deadlineDate,
    analyzedAt: now.toISOString(),
    totalTickets,
    completedTickets,
    remainingTickets,
    daysRemaining,
    daysElapsed: Math.round(daysElapsed),
    velocityPerDay: Math.round(velocityPerDay * 100) / 100,
    requiredVelocity: Math.round(requiredVelocity * 100) / 100,
    velocityGap: Math.round(velocityGap * 100) / 100,
    projectedCompletionDate,
    willMeetDeadline,
    riskLevel,
    narrative,
    recommendations,
  };
}
