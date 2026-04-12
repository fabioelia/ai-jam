import { eq, and } from 'drizzle-orm';
import { existsSync } from 'fs';
import { db } from '../db/connection.js';
import { repoWorkspaces, projects, features } from '../db/schema.js';
import { cloneRepo, getWorkspacePath, createWorktree, getWorktreePath } from './github-service.js';
import { v4 as uuid } from 'uuid';

export interface WorkspaceInfo {
  id: string;
  projectId: string;
  featureId: string | null;
  branch: string;
  localPath: string;
  status: string;
}

/**
 * Ensure a workspace exists for a project.
 * - If the project has a localPath, verify it exists and return it directly.
 * - If the project has a repoUrl, clone the repo if needed.
 */
export async function ensureWorkspace(
  projectId: string,
  featureId?: string,
  branch?: string,
): Promise<WorkspaceInfo> {
  // Get project
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error('Project not found');

  // Local path project — no cloning needed
  if (project.localPath) {
    if (!existsSync(project.localPath)) {
      throw new Error(`Local path does not exist: ${project.localPath}`);
    }

    // Check for existing workspace record
    const [existing] = await db.select().from(repoWorkspaces)
      .where(and(eq(repoWorkspaces.projectId, projectId), eq(repoWorkspaces.featureId, featureId ?? null as unknown as string)))
      .limit(1);

    if (existing && existing.status === 'ready') {
      return existing as WorkspaceInfo;
    }

    const workspaceId = existing?.id || uuid();
    const targetBranch = branch || project.defaultBranch;

    if (!existing) {
      await db.insert(repoWorkspaces).values({
        id: workspaceId,
        projectId,
        featureId: featureId || null,
        branch: targetBranch,
        localPath: project.localPath,
        status: 'ready',
      });
    }

    return {
      id: workspaceId,
      projectId,
      featureId: featureId || null,
      branch: targetBranch,
      localPath: project.localPath,
      status: 'ready',
    };
  }

  // Remote repo project — clone if needed
  if (!project.repoUrl) {
    throw new Error('Project has no repo URL or local path configured');
  }

  // Check for existing workspace
  const conditions = [eq(repoWorkspaces.projectId, projectId)];
  if (featureId) {
    conditions.push(eq(repoWorkspaces.featureId, featureId));
  }

  const [existing] = await db.select().from(repoWorkspaces).where(and(...conditions)).limit(1);
  if (existing && existing.status === 'ready') {
    return existing as WorkspaceInfo;
  }

  const targetBranch = branch || project.defaultBranch;

  // Create or update workspace record
  const workspaceId = existing?.id || uuid();
  const localPath = getWorkspacePath(projectId);

  if (!existing) {
    await db.insert(repoWorkspaces).values({
      id: workspaceId,
      projectId,
      featureId: featureId || null,
      branch: targetBranch,
      localPath,
      status: 'cloning',
    });
  } else {
    await db.update(repoWorkspaces)
      .set({ status: 'cloning' })
      .where(eq(repoWorkspaces.id, workspaceId));
  }

  try {
    await cloneRepo(project.repoUrl, project.githubTokenEncrypted || null, projectId, targetBranch);

    await db.update(repoWorkspaces)
      .set({ status: 'ready', localPath })
      .where(eq(repoWorkspaces.id, workspaceId));

    return {
      id: workspaceId,
      projectId,
      featureId: featureId || null,
      branch: targetBranch,
      localPath,
      status: 'ready',
    };
  } catch (err) {
    await db.update(repoWorkspaces)
      .set({ status: 'error' })
      .where(eq(repoWorkspaces.id, workspaceId));
    throw err;
  }
}

/**
 * Ensure a git worktree exists for a feature.
 * If the project has supportWorktrees disabled, returns the main workspace instead.
 * The main repo must already be cloned (calls ensureWorkspace first).
 * Creates a worktree at ~/.ai-jam/workspaces/{projectId}/worktrees/{featureId}/
 */
export async function ensureFeatureWorktree(
  projectId: string,
  featureId: string,
): Promise<WorkspaceInfo> {
  // Get project to check worktree support
  const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
  if (!project) throw new Error('Project not found');

  // If worktrees are disabled, just return the main workspace
  if (!project.supportWorktrees) {
    return ensureWorkspace(projectId, featureId);
  }

  // Check for existing feature workspace
  const [existing] = await db.select()
    .from(repoWorkspaces)
    .where(and(eq(repoWorkspaces.projectId, projectId), eq(repoWorkspaces.featureId, featureId)))
    .limit(1);

  if (existing && existing.status === 'ready') {
    return existing as WorkspaceInfo;
  }

  // Ensure the main repo is cloned first
  await ensureWorkspace(projectId);

  // Get feature for branch name
  const [feature] = await db.select().from(features).where(eq(features.id, featureId));
  if (!feature) throw new Error('Feature not found');

  // Generate a branch name from the feature title
  const branchName = feature.repoBranch ||
    `feature/${feature.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 50)}`;

  const workspaceId = existing?.id || uuid();
  const localPath = getWorktreePath(projectId, featureId);

  if (!existing) {
    await db.insert(repoWorkspaces).values({
      id: workspaceId,
      projectId,
      featureId,
      branch: branchName,
      localPath,
      status: 'cloning',
    });
  } else {
    await db.update(repoWorkspaces)
      .set({ status: 'cloning' })
      .where(eq(repoWorkspaces.id, workspaceId));
  }

  try {
    await createWorktree(projectId, featureId, branchName, project.defaultBranch);

    // Update feature with the branch name if not already set
    if (!feature.repoBranch) {
      await db.update(features)
        .set({ repoBranch: branchName })
        .where(eq(features.id, featureId));
    }

    await db.update(repoWorkspaces)
      .set({ status: 'ready', localPath })
      .where(eq(repoWorkspaces.id, workspaceId));

    return {
      id: workspaceId,
      projectId,
      featureId,
      branch: branchName,
      localPath,
      status: 'ready',
    };
  } catch (err) {
    await db.update(repoWorkspaces)
      .set({ status: 'error' })
      .where(eq(repoWorkspaces.id, workspaceId));
    throw err;
  }
}

/**
 * Get workspace status for a project.
 */
export async function getWorkspaceStatus(projectId: string): Promise<WorkspaceInfo | null> {
  const [workspace] = await db.select()
    .from(repoWorkspaces)
    .where(eq(repoWorkspaces.projectId, projectId))
    .limit(1);
  return workspace as WorkspaceInfo | null;
}
