import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import matter from 'gray-matter';

export interface PersonaConfig {
  id: string;
  name: string;
  phase: 'planning' | 'execution';
  model: string;
  maxConcurrent: number;
  color: string;
  canPush: boolean;
  canTransition: string[];
  outputsTo: string;
  timeoutMinutes: number;
  systemPrompt: string;
}

/**
 * Loads persona definitions from .md files with YAML frontmatter.
 */
export class PersonaLoader {
  private personas = new Map<string, PersonaConfig>();
  private personasDir: string;

  constructor(personasDir: string) {
    this.personasDir = personasDir;
  }

  /**
   * Load all persona files from the personas directory.
   */
  loadAll(): PersonaConfig[] {
    const files = readdirSync(this.personasDir).filter((f) => f.endsWith('.md'));
    const loaded: PersonaConfig[] = [];

    for (const file of files) {
      try {
        const persona = this.loadFile(join(this.personasDir, file));
        this.personas.set(persona.id, persona);
        loaded.push(persona);
      } catch (err) {
        console.error(`Failed to load persona ${file}:`, err);
      }
    }

    return loaded;
  }

  /**
   * Get a persona by ID.
   */
  get(id: string): PersonaConfig | undefined {
    return this.personas.get(id);
  }

  /**
   * Get all loaded personas.
   */
  getAll(): PersonaConfig[] {
    return [...this.personas.values()];
  }

  /**
   * Get personas by phase.
   */
  getByPhase(phase: 'planning' | 'execution'): PersonaConfig[] {
    return this.getAll().filter((p) => p.phase === phase);
  }

  private loadFile(filePath: string): PersonaConfig {
    const raw = readFileSync(filePath, 'utf-8');
    const { data: frontmatter, content } = matter(raw);

    return {
      id: frontmatter.id as string,
      name: frontmatter.name as string,
      phase: (frontmatter.phase as 'planning' | 'execution') || 'execution',
      model: (frontmatter.model as string) || 'sonnet',
      maxConcurrent: (frontmatter.max_concurrent as number) || 1,
      color: (frontmatter.color as string) || '#6b7280',
      canPush: (frontmatter.can_push as boolean) || false,
      canTransition: (frontmatter.can_transition as string[]) || [],
      outputsTo: (frontmatter.outputs_to as string) || 'ticket_comments',
      timeoutMinutes: (frontmatter.timeout_minutes as number) || 30,
      systemPrompt: content.trim(),
    };
  }
}
