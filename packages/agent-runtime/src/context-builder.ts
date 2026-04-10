import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadMemories, formatMemoriesForContext } from './memory-extractor.js';

export interface TicketContext {
  ticketId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  epicTitle: string | null;
  featureTitle: string;
  comments: Array<{ author: string; body: string; createdAt: string }>;
  handoffNotes: Array<{ from: string; to: string; content: string; createdAt: string }>;
}

export interface BoardContext {
  columns: Array<{
    status: string;
    ticketCount: number;
    tickets: Array<{ id: string; title: string; assignedPersona: string | null }>;
  }>;
}

export interface ContextBundle {
  ticket: TicketContext;
  board: BoardContext;
  personaSystemPrompt: string;
  personaType: string;
  repoPath: string | null;
}

/**
 * Builds context files for agent invocations.
 * Creates a markdown context file that gets passed to Claude CLI.
 */
export function buildContextFile(bundle: ContextBundle, outputDir: string): string {
  mkdirSync(outputDir, { recursive: true });

  const contextPath = join(outputDir, `context-${bundle.ticket.ticketId}.md`);

  const sections: string[] = [];

  // Ticket details
  sections.push(`# Ticket: ${bundle.ticket.title}`);
  sections.push('');
  sections.push(`- **ID**: ${bundle.ticket.ticketId}`);
  sections.push(`- **Status**: ${bundle.ticket.status}`);
  sections.push(`- **Priority**: ${bundle.ticket.priority}`);
  if (bundle.ticket.epicTitle) {
    sections.push(`- **Epic**: ${bundle.ticket.epicTitle}`);
  }
  sections.push(`- **Feature**: ${bundle.ticket.featureTitle}`);
  sections.push('');

  if (bundle.ticket.description) {
    sections.push('## Description');
    sections.push('');
    sections.push(bundle.ticket.description);
    sections.push('');
  }

  // Handoff notes
  if (bundle.ticket.handoffNotes.length > 0) {
    sections.push('## Handoff Notes');
    sections.push('');
    for (const note of bundle.ticket.handoffNotes) {
      sections.push(`### From ${note.from} → ${note.to} (${note.createdAt})`);
      sections.push('');
      sections.push(note.content);
      sections.push('');
    }
  }

  // Comments
  if (bundle.ticket.comments.length > 0) {
    sections.push('## Comments');
    sections.push('');
    for (const comment of bundle.ticket.comments) {
      sections.push(`**${comment.author}** (${comment.createdAt}):`);
      sections.push(comment.body);
      sections.push('');
    }
  }

  // Board overview
  sections.push('## Board State');
  sections.push('');
  for (const col of bundle.board.columns) {
    sections.push(`### ${col.status} (${col.ticketCount} tickets)`);
    for (const t of col.tickets) {
      const persona = t.assignedPersona ? ` [${t.assignedPersona}]` : '';
      sections.push(`- ${t.title}${persona}`);
    }
    sections.push('');
  }

  // Persona memory (past learnings)
  const memories = loadMemories(bundle.personaType);
  const memorySection = formatMemoriesForContext(memories);
  if (memorySection) {
    sections.push(memorySection);
  }

  // Protocol reminder
  sections.push('## Output Protocol');
  sections.push('');
  sections.push('When your work is complete, output these signals on their own lines:');
  sections.push('');
  sections.push('```');
  sections.push('WORK_COMPLETE: true');
  sections.push('SUMMARY: <one paragraph summary of what you did>');
  sections.push('NEXT_PERSONA: <persona_id or "none">');
  sections.push('```');
  sections.push('');
  sections.push('If you need the ticket moved to a different column:');
  sections.push('');
  sections.push('```');
  sections.push('TRANSITION_REQUEST: <column_name>');
  sections.push('REASON: <why this transition is appropriate>');
  sections.push('```');
  sections.push('');
  sections.push('If you encounter a blocker:');
  sections.push('');
  sections.push('```');
  sections.push('BLOCKER: <description of the blocker>');
  sections.push('BLOCKED_BY: <ticket_id if applicable>');
  sections.push('```');
  sections.push('');
  sections.push('To record learnings for future sessions:');
  sections.push('');
  sections.push('```');
  sections.push('LEARNING: pattern | <description of a useful pattern>');
  sections.push('LEARNING: pitfall | <description of something to avoid>');
  sections.push('```');

  const content = sections.join('\n');
  writeFileSync(contextPath, content, 'utf-8');
  return contextPath;
}

/**
 * Parse structured signals from agent output.
 */
export function parseSignals(output: string): Record<string, string> {
  const signals: Record<string, string> = {};
  const lines = output.split('\n');

  for (const line of lines) {
    const match = line.match(/^(WORK_COMPLETE|SUMMARY|NEXT_PERSONA|TRANSITION_REQUEST|REASON|BLOCKER|BLOCKED_BY):\s*(.+)$/);
    if (match) {
      signals[match[1]] = match[2].trim();
    }
  }

  return signals;
}
