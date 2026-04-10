import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

const MEMORY_DIR = join(process.env.HOME || '/tmp', '.ai-jam', 'memory');

export interface MemoryEntry {
  id: string;
  personaType: string;
  ticketId: string;
  category: 'pattern' | 'pitfall' | 'preference' | 'technique';
  content: string;
  createdAt: string;
}

/**
 * Extract learnings from a completed agent session's output.
 *
 * Looks for explicit LEARNING signals and also heuristically extracts
 * common patterns (things that went wrong, things that worked, etc.)
 */
export function extractMemories(
  personaType: string,
  ticketId: string,
  output: string,
): MemoryEntry[] {
  const memories: MemoryEntry[] = [];
  const now = new Date().toISOString();
  let idCounter = 0;

  // 1. Explicit LEARNING signals: LEARNING: <category> | <content>
  const learningPattern = /^LEARNING:\s*(pattern|pitfall|preference|technique)\s*\|\s*(.+)$/gm;
  let match;
  while ((match = learningPattern.exec(output)) !== null) {
    memories.push({
      id: `${ticketId}-${++idCounter}`,
      personaType,
      ticketId,
      category: match[1] as MemoryEntry['category'],
      content: match[2].trim(),
      createdAt: now,
    });
  }

  // 2. Heuristic extraction: retry patterns
  const retryPatterns = [
    /(?:had to|needed to|found that|realized|discovered|learned)\s+(.{20,150})/gi,
    /(?:better approach|should have|next time|in the future|note to self)\s*[:—-]\s*(.{20,150})/gi,
  ];

  for (const pattern of retryPatterns) {
    let hMatch;
    while ((hMatch = pattern.exec(output)) !== null) {
      const content = hMatch[1].trim();
      // Avoid duplicates and very short matches
      if (content.length > 30 && !memories.some((m) => m.content === content)) {
        memories.push({
          id: `${ticketId}-${++idCounter}`,
          personaType,
          ticketId,
          category: 'technique',
          content,
          createdAt: now,
        });
      }
    }
  }

  return memories;
}

/**
 * Save extracted memories to disk, organized by persona type.
 */
export function saveMemories(memories: MemoryEntry[]): void {
  if (memories.length === 0) return;

  for (const memory of memories) {
    const personaDir = join(MEMORY_DIR, memory.personaType);
    mkdirSync(personaDir, { recursive: true });

    const filePath = join(personaDir, `${memory.id}.json`);
    writeFileSync(filePath, JSON.stringify(memory, null, 2), 'utf-8');
  }
}

/**
 * Load memories for a given persona type, optionally limited to N most recent.
 */
export function loadMemories(personaType: string, limit = 20): MemoryEntry[] {
  const personaDir = join(MEMORY_DIR, personaType);
  if (!existsSync(personaDir)) return [];

  const files = readdirSync(personaDir).filter((f) => f.endsWith('.json'));
  const memories: MemoryEntry[] = [];

  for (const file of files) {
    try {
      const raw = readFileSync(join(personaDir, file), 'utf-8');
      memories.push(JSON.parse(raw));
    } catch {
      // Skip corrupted files
    }
  }

  // Sort newest first, limit
  memories.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return memories.slice(0, limit);
}

/**
 * Format memories as a markdown section for injection into context files.
 */
export function formatMemoriesForContext(memories: MemoryEntry[]): string {
  if (memories.length === 0) return '';

  const sections = ['## Persona Memory (Past Learnings)', ''];

  const byCategory = new Map<string, MemoryEntry[]>();
  for (const m of memories) {
    const list = byCategory.get(m.category) || [];
    list.push(m);
    byCategory.set(m.category, list);
  }

  const categoryLabels: Record<string, string> = {
    pattern: 'Patterns & Best Practices',
    pitfall: 'Known Pitfalls',
    preference: 'Project Preferences',
    technique: 'Techniques & Approaches',
  };

  for (const [category, items] of byCategory) {
    sections.push(`### ${categoryLabels[category] || category}`);
    sections.push('');
    for (const item of items) {
      sections.push(`- ${item.content}`);
    }
    sections.push('');
  }

  return sections.join('\n');
}
