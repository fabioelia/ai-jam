import simpleGit, { type SimpleGit } from 'simple-git';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

const WORKSPACES_DIR = join(process.env.HOME || '/tmp', '.ai-jam', 'workspaces');

export interface RepoInfo {
  owner: string;
  repo: string;
  defaultBranch: string;
  description: string | null;
  private: boolean;
}

export interface BranchInfo {
  name: string;
  sha: string;
  protected: boolean;
}

export interface PullRequestResult {
  number: number;
  url: string;
  title: string;
}

/**
 * Normalize a repo URL into an "owner/repo" slug.
 * Handles:
 *   https://github.com/owner/repo
 *   https://github.com/owner/repo.git
 *   git@github.com:owner/repo.git
 *   owner/repo
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } {
  // Already owner/repo format
  const shortMatch = url.match(/^([^/:@]+)\/([^/.]+)$/);
  if (shortMatch) {
    return { owner: shortMatch[1], repo: shortMatch[2] };
  }

  // HTTPS or SSH github URL
  const match = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  throw new Error(`Cannot parse GitHub URL: ${url}`);
}

/**
 * Convert any repo URL to the "owner/repo" form that `gh repo clone` accepts.
 */
export function repoSlug(url: string): string {
  const { owner, repo } = parseRepoUrl(url);
  return `${owner}/${repo}`;
}

/**
 * Clone a repository using `gh repo clone`, which automatically uses the
 * user's `gh auth` session (no separate token needed).
 * Falls back to plain `git clone` for non-GitHub repos.
 */
export async function cloneRepo(
  repoUrl: string,
  _token: string | null, // kept for backward compat, ignored — gh handles auth
  projectId: string,
  branch?: string,
): Promise<string> {
  mkdirSync(WORKSPACES_DIR, { recursive: true });

  const localPath = join(WORKSPACES_DIR, projectId);

  if (existsSync(localPath)) {
    // Already cloned — pull latest
    const git: SimpleGit = simpleGit(localPath);
    try { await git.pull(); } catch { /* offline or auth issue — stale is fine */ }
    if (branch) {
      try { await git.checkout(branch); } catch { /* branch might not exist yet */ }
    }
    return localPath;
  }

  // Try gh repo clone first (handles auth via gh CLI)
  try {
    const slug = repoSlug(repoUrl);
    // Don't pass --branch on initial clone — let git pick the repo's default branch.
    // We'll checkout the desired branch after if it differs.
    await execFileAsync('gh', ['repo', 'clone', slug, localPath], { timeout: 120_000 });
  } catch (ghErr) {
    console.warn('[github-service] gh clone failed, falling back to git clone:', (ghErr as Error).message);

    // Fallback: plain git clone (works for public repos or if git has credentials configured)
    const git: SimpleGit = simpleGit();
    await git.clone(repoUrl, localPath);
  }

  // Checkout the requested branch if specified
  if (branch) {
    const git: SimpleGit = simpleGit(localPath);
    try { await git.checkout(branch); } catch { /* branch may not exist — stay on default */ }
  }

  return localPath;
}

/**
 * Create a feature branch in a local workspace.
 */
export async function createBranch(
  localPath: string,
  branchName: string,
  baseBranch?: string,
): Promise<void> {
  const git: SimpleGit = simpleGit(localPath);

  if (baseBranch) {
    await git.checkout(baseBranch);
    await git.pull();
  }

  await git.checkoutLocalBranch(branchName);
}

/**
 * Push a branch to the remote.
 */
export async function pushBranch(localPath: string, branchName: string): Promise<void> {
  const git: SimpleGit = simpleGit(localPath);
  await git.push('origin', branchName, ['--set-upstream']);
}

/**
 * Create a pull request via gh CLI.
 */
export async function createPullRequest(
  _octokit: unknown,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<PullRequestResult> {
  const { stdout } = await execFileAsync('gh', [
    'pr', 'create',
    '--repo', `${owner}/${repo}`,
    '--title', title,
    '--body', body,
    '--head', head,
    '--base', base,
    '--json', 'number,url,title',
  ]);

  const data = JSON.parse(stdout);
  return {
    number: data.number,
    url: data.url,
    title: data.title,
  };
}

/**
 * Get the local workspace path for a project.
 */
export function getWorkspacePath(projectId: string): string {
  return join(WORKSPACES_DIR, projectId);
}

/**
 * Get the worktree path for a feature within a project.
 */
export function getWorktreePath(projectId: string, featureId: string): string {
  return join(WORKSPACES_DIR, projectId, 'worktrees', featureId);
}

/**
 * Create a git worktree for a feature.
 * This gives each feature an isolated working copy of the repo.
 */
export async function createWorktree(
  projectId: string,
  featureId: string,
  branchName: string,
  baseBranch?: string,
): Promise<string> {
  const mainPath = getWorkspacePath(projectId);
  const worktreePath = getWorktreePath(projectId, featureId);

  if (existsSync(worktreePath)) {
    return worktreePath;
  }

  const git: SimpleGit = simpleGit(mainPath);

  // Ensure we're up to date
  try { await git.fetch(); } catch { /* offline is OK */ }

  // Create the worktree with a new branch from base
  const base = baseBranch || 'main';
  await git.raw(['worktree', 'add', '-b', branchName, worktreePath, base]);

  return worktreePath;
}

/**
 * Remove a git worktree.
 */
export async function removeWorktree(projectId: string, featureId: string): Promise<void> {
  const mainPath = getWorkspacePath(projectId);
  const worktreePath = getWorktreePath(projectId, featureId);

  if (!existsSync(worktreePath)) return;

  const git: SimpleGit = simpleGit(mainPath);
  await git.raw(['worktree', 'remove', worktreePath, '--force']);
}
