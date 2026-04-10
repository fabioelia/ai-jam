import { Octokit } from 'octokit';
import simpleGit, { type SimpleGit } from 'simple-git';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

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
 * Parse a GitHub URL into owner/repo.
 */
export function parseRepoUrl(url: string): { owner: string; repo: string } {
  // Handles https://github.com/owner/repo.git and git@github.com:owner/repo.git
  const httpsMatch = url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (httpsMatch) {
    return { owner: httpsMatch[1], repo: httpsMatch[2] };
  }
  throw new Error(`Cannot parse GitHub URL: ${url}`);
}

/**
 * Create an Octokit client from a GitHub token.
 */
export function createOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

/**
 * Get repository information.
 */
export async function getRepoInfo(octokit: Octokit, owner: string, repo: string): Promise<RepoInfo> {
  const { data } = await octokit.rest.repos.get({ owner, repo });
  return {
    owner,
    repo,
    defaultBranch: data.default_branch,
    description: data.description,
    private: data.private,
  };
}

/**
 * List branches for a repository.
 */
export async function listBranches(octokit: Octokit, owner: string, repo: string): Promise<BranchInfo[]> {
  const { data } = await octokit.rest.repos.listBranches({ owner, repo, per_page: 100 });
  return data.map((b) => ({
    name: b.name,
    sha: b.commit.sha,
    protected: b.protected,
  }));
}

/**
 * Clone a repository to a local workspace directory.
 * Returns the local path. Works for public repos without a token.
 */
export async function cloneRepo(
  repoUrl: string,
  token: string | null,
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

  // Build clone URL — add token auth if available
  let cloneUrl = repoUrl;
  if (token) {
    cloneUrl = repoUrl.replace('https://', `https://x-access-token:${token}@`);
  }

  const git: SimpleGit = simpleGit();
  const options: string[] = [];
  if (branch) {
    options.push('--branch', branch);
  }
  await git.clone(cloneUrl, localPath, options);

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
 * Create a pull request via GitHub API.
 */
export async function createPullRequest(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<PullRequestResult> {
  const { data } = await octokit.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });

  return {
    number: data.number,
    url: data.html_url,
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
