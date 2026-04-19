import { db } from '../db/connection.js';
import { tickets } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

interface ReleaseNoteItem {
  ticketId: string;
  title: string;
  headline: string;
}

interface ReleaseNotesResult {
  version: string;
  summary: string;
  features: ReleaseNoteItem[];
  bugFixes: ReleaseNoteItem[];
  improvements: ReleaseNoteItem[];
  infrastructure: ReleaseNoteItem[];
  markdown: string;
  generatedAt: string;
}

function basicFallback(doneTickets: typeof tickets.$inferSelect[]): ReleaseNotesResult {
  const titles = doneTickets.map(t => `- ${t.title}`).join('\n');
  return {
    version: '1.0.0',
    summary: 'Release notes generation failed.',
    features: [],
    bugFixes: [],
    improvements: [],
    infrastructure: [],
    markdown: `# Release v1.0.0\n\nRelease notes generation failed.\n\n## Completed Items\n\n${titles}`,
    generatedAt: new Date().toISOString(),
  };
}

export async function generateReleaseNotes(featureId: string): Promise<ReleaseNotesResult> {
  const doneTickets = await db.select().from(tickets)
    .where(and(eq(tickets.featureId, featureId), eq(tickets.status, 'done')));

  if (doneTickets.length === 0) {
    return {
      version: '1.0.0',
      summary: 'No completed tickets found for this feature.',
      features: [],
      bugFixes: [],
      improvements: [],
      infrastructure: [],
      markdown: '# Release v1.0.0\n\nNo completed tickets found.',
      generatedAt: new Date().toISOString(),
    };
  }

  const ticketSummary = doneTickets.map(t => {
    const desc = t.description ? `\n  Description: ${t.description}` : '';
    return `- [${t.id}] "${t.title}"${desc}`;
  }).join('\n');

  const client = new Anthropic({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: process.env.ANTHROPIC_BASE_URL || 'https://openrouter.ai/api/v1',
  });

  const prompt = `You are a release notes generator. Analyze these completed tickets and generate a categorized changelog.

Completed Tickets (${doneTickets.length} done):
${ticketSummary}

Return ONLY a JSON object (no markdown) with this exact structure:
{
  "version": "1.0.0",
  "summary": "One-paragraph prose describing the overall release",
  "features": [{"ticketId": "<id>", "title": "<title>", "headline": "<one-line description>"}],
  "bugFixes": [{"ticketId": "<id>", "title": "<title>", "headline": "<one-line description>"}],
  "improvements": [{"ticketId": "<id>", "title": "<title>", "headline": "<one-line description>"}],
  "infrastructure": [{"ticketId": "<id>", "title": "<title>", "headline": "<one-line description>"}],
  "generatedAt": "<ISO string>"
}

Rules:
- Categorize each ticket into exactly one category based on its title/description
- features: new capabilities, user-facing functionality
- bugFixes: bug fixes, crash fixes, error handling
- improvements: performance, UX polish, refactoring
- infrastructure: dev tooling, CI, deps, config
- headline should be concise, user-friendly (not just repeat title)
- version: suggest a reasonable semver based on scope (0.x.y for small, 1.0.0 for big, x.y.z increment)`;

  let content: string;
  try {
    const response = await client.messages.create({
      model: process.env.AI_MODEL || 'qwen/qwen3-6b',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });
    content = response.content[0].type === 'text' ? response.content[0].text : '';
  } catch {
    return basicFallback(doneTickets);
  }

  let parsed: ReleaseNotesResult;
  try {
    const jsonText = content.match(/\{[\s\S]*\}/)?.[0] || content;
    parsed = JSON.parse(jsonText);
  } catch {
    return basicFallback(doneTickets);
  }

  const markdown = buildMarkdown(parsed);
  parsed.markdown = markdown;

  return parsed;
}

function buildMarkdown(result: ReleaseNotesResult): string {
  const lines: string[] = [`# Release v${result.version}`, '', result.summary, ''];

  const sections: [string, ReleaseNoteItem[]][] = [
    ['✨ Features', result.features],
    ['🐛 Bug Fixes', result.bugFixes],
    ['🔧 Improvements', result.improvements],
    ['🏗 Infrastructure', result.infrastructure],
  ];

  for (const [heading, items] of sections) {
    if (items.length > 0) {
      lines.push(`## ${heading}`, '');
      for (const item of items) {
        lines.push(`- [${item.ticketId}] ${item.headline}`);
      }
      lines.push('');
    }
  }

  lines.push(`_Generated at ${new Date(result.generatedAt).toLocaleString()}_`);
  return lines.join('\n');
}
