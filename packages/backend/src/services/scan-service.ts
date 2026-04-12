import { eq } from 'drizzle-orm';
import { join } from 'path';
import { mkdirSync, readdirSync, existsSync, writeFileSync } from 'fs';
import { db } from '../db/connection.js';
import { projectScans, projects, systemPrompts, agentSessions } from '../db/schema.js';
import { getRuntimeClient } from '../agent-runtime/runtime-manager.js';
import { ensureWorkspace } from './repo-workspace.js';
import { v4 as uuid } from 'uuid';

const WORKSPACES_DIR = join(process.env.HOME || '/tmp', '.ai-jam', 'workspaces');

/** The files the scanner agent is expected to produce. */
export const EXPECTED_KNOWLEDGE_FILES = [
  'architecture.md',
  'tech-stack.md',
  'patterns.md',
  'data-models.md',
  'api-surface.md',
  'key-files.md',
];

/**
 * Living documents that agents read and append to over time.
 * Created as stubs during the first scan; not expected from the scanner.
 */
export const LIVING_KNOWLEDGE_FILES: Record<string, string> = {
  'memories.md': `# Memories

This file is a shared memory for all AI agents working on this project.
Agents should append important discoveries, decisions, and context here
so that future agent sessions have access to accumulated knowledge.

## How to use
- **Read** this file at the start of every session for context.
- **Append** new entries at the bottom when you learn something important.
- Format: \`## YYYY-MM-DD — <topic>\` followed by a short note.
- Keep entries concise — this is a reference, not a journal.
`,
  'project-learnings.md': `# Project Learnings

This file captures technical learnings, gotchas, and patterns specific
to this project that aren't obvious from the code alone.

## How to use
- **Read** this file before making changes to avoid known pitfalls.
- **Append** new entries when you hit a non-obvious issue or find a pattern worth documenting.
- Format: \`## <topic>\` followed by a short explanation.
- Include file paths and code snippets when relevant.
`,
};

/** Max follow-up rounds after the initial scan response. */
const MAX_VALIDATION_ATTEMPTS = 2;

/**
 * Get the knowledge directory for a project.
 */
export function getKnowledgePath(projectId: string): string {
  return join(WORKSPACES_DIR, projectId, 'knowledge');
}

/**
 * List existing knowledge files for a project.
 */
export function listKnowledgeFiles(projectId: string): string[] {
  const knowledgeDir = getKnowledgePath(projectId);
  try {
    return readdirSync(knowledgeDir).filter((f) => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/**
 * Validate that expected knowledge files exist on disk.
 * Returns present and missing file lists.
 */
export function validateKnowledgeFiles(projectId: string): { present: string[]; missing: string[] } {
  const knowledgeDir = getKnowledgePath(projectId);
  const present: string[] = [];
  const missing: string[] = [];
  for (const file of EXPECTED_KNOWLEDGE_FILES) {
    if (existsSync(join(knowledgeDir, file))) {
      present.push(file);
    } else {
      missing.push(file);
    }
  }
  return { present, missing };
}

/**
 * Build the initial scan prompt that tells Claude where to write files.
 */
export function buildScanPrompt(knowledgePath: string, customPrompt?: string | null): string {
  const parts: string[] = [];

  if (customPrompt) {
    parts.push(customPrompt);
    parts.push('');
  }

  parts.push(`Scan this repository thoroughly and produce structured knowledge files.`);
  parts.push(`Write each file directly to: ${knowledgePath}`);
  parts.push('');
  parts.push('Create ALL of these files:');
  for (const f of EXPECTED_KNOWLEDGE_FILES) {
    parts.push(`- ${knowledgePath}/${f}`);
  }
  parts.push('');
  parts.push('IMPORTANT: The following living documents already exist in that directory. Do NOT overwrite them:');
  for (const f of Object.keys(LIVING_KNOWLEDGE_FILES)) {
    parts.push(`- ${f} (shared memory file — agents read and append over time)`);
  }

  return parts.join('\n');
}

/**
 * Build a follow-up prompt when validation finds missing files.
 */
export function buildValidationFollowup(
  knowledgePath: string,
  present: string[],
  missing: string[],
): string {
  const parts: string[] = [];
  if (present.length > 0) {
    parts.push(`You created: ${present.join(', ')}. Good.`);
  }
  parts.push(`Still missing: ${missing.join(', ')}`);
  parts.push(`Write the missing files to: ${knowledgePath}`);
  return parts.join('\n');
}

/**
 * Finalize a scan — update the DB record with results.
 */
export async function finalizeScan(
  scanId: string,
  projectId: string,
  present: string[],
  missing?: string[],
) {
  const summary = missing && missing.length > 0
    ? `Generated ${present.length}/${EXPECTED_KNOWLEDGE_FILES.length} files. Missing: ${missing.join(', ')}`
    : `Generated ${present.length} knowledge files: ${present.join(', ')}`;

  await db.update(projectScans).set({
    status: 'completed',
    completedAt: new Date(),
    outputFiles: present,
    outputSummary: summary,
  }).where(eq(projectScans.id, scanId));

  console.log(`[scan-service] Scan ${scanId.slice(0, 8)} finalized: ${summary}`);
}

/**
 * Trigger a repo scan for a project.
 * Spawns an interactive Claude CLI session with the repo-scanner persona.
 * After each response, the backend validates expected files and sends
 * follow-up prompts if any are missing.
 */
export async function triggerScan(projectId: string, systemPromptId?: string) {
  // Get project
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error('Project not found');

  // Resolve working directory (local path or cloned repo)
  let workingDirectory: string;
  if (project.localPath) {
    workingDirectory = project.localPath;
  } else {
    try {
      const workspace = await ensureWorkspace(projectId);
      workingDirectory = workspace.localPath;
    } catch (err) {
      throw new Error(`Cannot scan — repo not available: ${(err as Error).message}`);
    }
  }

  // Get optional custom prompt from systemPrompts table
  let customPrompt: string | null = null;
  let resolvedPromptId: string | null = systemPromptId || null;

  if (systemPromptId) {
    const [sp] = await db.select().from(systemPrompts).where(eq(systemPrompts.id, systemPromptId));
    if (sp) customPrompt = sp.content;
  }

  if (!customPrompt) {
    const [projectPrompt] = await db.select().from(systemPrompts)
      .where(eq(systemPrompts.slug, 'repo-scanner'))
      .limit(1);
    if (projectPrompt) {
      customPrompt = projectPrompt.content;
      resolvedPromptId = projectPrompt.id;
    }
  }

  // Prepare knowledge directory + living doc stubs
  const knowledgePath = getKnowledgePath(projectId);
  mkdirSync(knowledgePath, { recursive: true });

  for (const [filename, content] of Object.entries(LIVING_KNOWLEDGE_FILES)) {
    const filePath = join(knowledgePath, filename);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, content, 'utf-8');
      console.log(`[scan-service] Created living doc stub: ${filePath}`);
    }
  }

  const scanId = uuid();
  const agentSessionId = uuid();
  const prompt = buildScanPrompt(knowledgePath, customPrompt);

  // Create scan record
  const [scan] = await db.insert(projectScans).values({
    id: scanId,
    projectId,
    systemPromptId: resolvedPromptId,
    status: 'running',
    agentSessionId,
    startedAt: new Date(),
  }).returning();

  // Create agent session record
  await db.insert(agentSessions).values({
    id: agentSessionId,
    personaType: 'repo_scanner',
    status: 'pending',
    activity: 'idle',
    prompt,
    workingDirectory,
  });

  // Register scan state for validation tracking.
  // Use pty-daemon manager if available, fall back to runtime-manager.
  const { getPtyDaemonClient, registerPtyScanSession } = await import('../agent-runtime/pty-daemon-manager.js');
  const { registerScanSession } = await import('../agent-runtime/runtime-manager.js');

  const ptyClient = getPtyDaemonClient();
  const rtClient = getRuntimeClient();
  const usePtyDaemon = ptyClient.isConnected;

  if (usePtyDaemon) {
    registerPtyScanSession(agentSessionId, {
      projectId,
      scanId,
      knowledgePath,
      maxAttempts: MAX_VALIDATION_ATTEMPTS,
    });
  } else {
    registerScanSession(agentSessionId, {
      projectId,
      scanId,
      knowledgePath,
      maxAttempts: MAX_VALIDATION_ATTEMPTS,
    });
  }

  // Spawn the scanner agent (interactive mode so we can send follow-ups)
  const client = usePtyDaemon ? ptyClient : rtClient;
  if (!client.isConnected) {
    await db.update(projectScans)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(projectScans.id, scanId));
    await db.update(agentSessions)
      .set({ status: 'failed', activity: 'idle', completedAt: new Date() })
      .where(eq(agentSessions.id, agentSessionId));
    throw new Error('Agent runtime not connected');
  }

  try {
    await client.spawnSession({
      sessionId: agentSessionId,
      sessionType: 'scan',
      personaType: 'repo_scanner',
      model: 'sonnet',
      prompt,
      workingDirectory,
      interactive: true,
      addDirs: [knowledgePath],
      systemContext: `Scanning project "${project.name}" (${project.repoUrl || project.localPath}, branch: ${project.defaultBranch}).`,
    });
  } catch (err) {
    await db.update(projectScans)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(projectScans.id, scanId));
    await db.update(agentSessions)
      .set({ status: 'failed', activity: 'idle', completedAt: new Date() })
      .where(eq(agentSessions.id, agentSessionId));
    throw err;
  }

  return scan;
}
