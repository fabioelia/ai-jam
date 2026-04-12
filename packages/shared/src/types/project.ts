import type { FeatureStatus, ProjectRole } from '../enums.js';

export interface Project {
  id: string;
  name: string;
  repoUrl: string | null;
  localPath: string | null;
  defaultBranch: string;
  supportWorktrees: boolean;
  personaModelOverrides: Record<string, string>;
  maxRejectionCycles: number;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  role: ProjectRole;
}

export interface Feature {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  repoBranch: string | null;
  status: FeatureStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectRequest {
  name: string;
  repoUrl?: string;
  localPath?: string;
  defaultBranch?: string;
  supportWorktrees?: boolean;
  githubToken?: string;
}

export interface CreateFeatureRequest {
  title: string;
  description?: string;
  repoBranch?: string;
}
