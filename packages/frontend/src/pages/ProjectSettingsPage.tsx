import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../api/queries.js';
import { useProjectSystemPrompts, useProjectScans, useKnowledgeFiles, useKnowledgeFile, useUsers, useProjectMembers, useNotificationPreferences } from '../api/queries.js';
import type { SystemPrompt, ProjectScan } from '../api/queries.js';
import { useUpdateProject, useDeleteProject, useUpdateSystemPrompt, useTriggerScan, useAddProjectMember, useRemoveProjectMember, useUpdateNotificationPreferences } from '../api/mutations.js';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../stores/auth-store.js';
import MarkdownEditor from '../components/common/MarkdownEditor.js';

type Tab = 'general' | 'members' | 'notifications' | 'prompts' | 'scans' | 'knowledge' | 'agents';

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const [activeTab, setActiveTab] = useState<Tab>('general');

  const { data: project } = useProject(projectId!);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'general', label: 'General' },
    { key: 'members', label: 'Members' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'prompts', label: 'System Prompts' },
    { key: 'scans', label: 'Repo Scans' },
    { key: 'agents', label: 'Agent Models' },
    { key: 'knowledge', label: 'Knowledge Files' },
  ];

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(`/projects/${projectId}/board`)}
              className="text-gray-400 hover:text-white text-sm"
            >
              &larr; Board
            </button>
            <h1 className="text-xl font-bold text-white">{project?.name || 'Project'} Settings</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-gray-300 text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 border-b border-gray-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 text-sm font-medium -mb-px border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-500 text-white'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === 'general' && <GeneralTab projectId={projectId!} />}
        {activeTab === 'members' && <MembersTab projectId={projectId!} />}
        {activeTab === 'notifications' && <NotificationsTab projectId={projectId!} />}
        {activeTab === 'prompts' && <SystemPromptsTab projectId={projectId!} />}
        {activeTab === 'scans' && <ScansTab projectId={projectId!} />}
        {activeTab === 'knowledge' && <KnowledgeTab projectId={projectId!} />}
        {activeTab === 'agents' && <AgentModelsTab projectId={projectId!} />}
      </main>
    </div>
  );
}

// ---- General Tab ----

function GeneralTab({ projectId }: { projectId: string }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const deleteProject = useDeleteProject();
  const triggerScan = useTriggerScan(projectId);

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [defaultBranch, setDefaultBranch] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [maxRejectionCycles, setMaxRejectionCycles] = useState(3);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const latestScanRef = useRef<string | undefined>(undefined);
  const { data: scans } = useProjectScans(projectId, latestScanRef.current === 'running' || latestScanRef.current === 'pending');

  const latestScan = scans?.[0];
  const isScanning = latestScan?.status === 'running' || latestScan?.status === 'pending';

  // Track scan status transitions — invalidate knowledge when scan completes
  useEffect(() => {
    const prev = latestScanRef.current;
    latestScanRef.current = latestScan?.status;
    if ((prev === 'running' || prev === 'pending') && latestScan?.status === 'completed') {
      qc.invalidateQueries({ queryKey: ['knowledge', projectId] });
    }
  }, [latestScan?.status, projectId, qc]);

  function startEdit() {
    if (!project) return;
    setName(project.name);
    setDefaultBranch(project.defaultBranch);
    setGithubToken('');
    setMaxRejectionCycles(project.maxRejectionCycles ?? 3);
    setIsEditing(true);
  }

  function handleSave() {
    const data: { name: string; defaultBranch: string; githubToken?: string; maxRejectionCycles: number } = { name, defaultBranch, maxRejectionCycles };
    if (githubToken) data.githubToken = githubToken;
    updateProject.mutate(data, { onSuccess: () => setIsEditing(false) });
  }

  function handleDelete() {
    deleteProject.mutate(projectId, {
      onSuccess: () => navigate('/'),
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Project details */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Project Details</h3>
          {!isEditing && (
            <button
              onClick={startEdit}
              className="text-gray-400 hover:text-white text-xs px-3 py-1.5 border border-gray-700 rounded-lg hover:border-gray-600"
            >
              Edit
            </button>
          )}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Default Branch</label>
              <input
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            {project?.repoUrl && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Repository URL</label>
                <input
                  value={project.repoUrl}
                  disabled
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-500 cursor-not-allowed"
                />
                <p className="text-xs text-gray-600 mt-1">Repository URL cannot be changed after creation.</p>
              </div>
            )}
            {project?.localPath && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">Local Path</label>
                <input
                  value={project.localPath}
                  disabled
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-lg px-3 py-2 text-gray-500 cursor-not-allowed font-mono text-sm"
                />
              </div>
            )}
            {project?.repoUrl && (
              <div>
                <label className="block text-sm text-gray-400 mb-1">GitHub Token (PAT)</label>
                <input
                  type="password"
                  value={githubToken}
                  onChange={(e) => setGithubToken(e.target.value)}
                  placeholder={(project as unknown as Record<string, unknown>)?.githubTokenEncrypted ? '••••••• (token set — leave blank to keep)' : 'ghp_... (required for private repos)'}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                />
                <p className="text-xs text-gray-600 mt-1">Personal access token with repo scope. Leave blank to keep the existing token.</p>
              </div>
            )}
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Rejection Cycles</label>
              <input
                type="number"
                min={1}
                max={10}
                value={maxRejectionCycles}
                onChange={(e) => setMaxRejectionCycles(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                className="w-32 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
              />
              <p className="text-xs text-gray-600 mt-1">How many rejection cycles before escalating to a human (1–10).</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSave}
                disabled={updateProject.isPending}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {updateProject.isPending ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={() => setIsEditing(false)}
                className="text-gray-400 hover:text-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Name</span>
              <span className="text-sm text-white">{project?.name}</span>
            </div>
            {project?.repoUrl && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Repository</span>
                <span className="text-sm text-gray-300 font-mono">{project.repoUrl}</span>
              </div>
            )}
            {project?.localPath && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Local Path</span>
                <span className="text-sm text-gray-300 font-mono">{project.localPath}</span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Default Branch</span>
              <span className="text-sm text-gray-300 font-mono">{project?.defaultBranch}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Worktrees</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                project?.supportWorktrees
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-gray-500/20 text-gray-400'
              }`}>
                {project?.supportWorktrees ? 'enabled' : 'disabled'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Max Rejection Cycles</span>
              <span className="text-sm text-gray-300">{project?.maxRejectionCycles ?? 3}</span>
            </div>
            {project?.repoUrl && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">GitHub Token</span>
                {(project as unknown as Record<string, unknown>)?.githubTokenEncrypted ? (
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">configured</span>
                ) : (
                  <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">not set</span>
                )}
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-500">Created</span>
              <span className="text-sm text-gray-400">{project ? new Date(project.createdAt).toLocaleDateString() : '-'}</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Actions</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-white">Sync / Scan Repository</p>
              <p className="text-xs text-gray-500">
                {latestScan
                  ? `Last scan: ${new Date(latestScan.createdAt).toLocaleString()} (${latestScan.status})`
                  : 'No scans run yet'}
              </p>
            </div>
            <button
              onClick={() => triggerScan.mutate(undefined)}
              disabled={triggerScan.isPending || isScanning}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {isScanning ? 'Scanning...' : triggerScan.isPending ? 'Starting...' : 'Run Scan'}
            </button>
          </div>
          {triggerScan.isError && (
            <p className="text-red-400 text-xs">{(triggerScan.error as Error).message}</p>
          )}
          {triggerScan.isSuccess && (
            <p className="text-green-400 text-xs">Scan started.</p>
          )}
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-gray-900 border border-red-900/50 rounded-xl p-6">
        <h3 className="text-red-400 font-medium mb-2">Danger Zone</h3>
        {!showDeleteConfirm ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-300">Delete this project</p>
              <p className="text-xs text-gray-500">This will remove all features, tickets, and scans. This cannot be undone.</p>
            </div>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="text-red-400 hover:text-red-300 text-sm px-4 py-2 border border-red-900 rounded-lg hover:border-red-700"
            >
              Delete Project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-red-300">Are you sure? This will permanently delete <strong>{project?.name}</strong> and all associated data.</p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteProject.isPending}
                className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {deleteProject.isPending ? 'Deleting...' : 'Yes, Delete'}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="text-gray-400 hover:text-gray-300 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
            {deleteProject.isError && (
              <p className="text-red-400 text-xs mt-2">{(deleteProject.error as Error).message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Members Tab ----

function MembersTab({ projectId }: { projectId: string }) {
  const { data: members, isLoading: membersLoading } = useProjectMembers(projectId);
  const { data: allUsers, isLoading: usersLoading } = useUsers();
  const { data: project } = useProject(projectId);
  const addMember = useAddProjectMember(projectId);
  const removeMember = useRemoveProjectMember(projectId);
  const [selectedUserId, setSelectedUserId] = useState('');

  const memberIds = new Set(members?.map((m) => m.userId) || []);
  const availableUsers = allUsers?.filter((u) => !memberIds.has(u.id)) || [];

  function handleAdd() {
    if (!selectedUserId) return;
    addMember.mutate({ userId: selectedUserId }, {
      onSuccess: () => setSelectedUserId(''),
    });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Add member */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Add Member</h3>
        <div className="flex items-center gap-3">
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Select a user...</option>
            {usersLoading ? (
              <option disabled>Loading...</option>
            ) : (
              availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))
            )}
          </select>
          <button
            onClick={handleAdd}
            disabled={!selectedUserId || addMember.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {addMember.isPending ? 'Adding...' : 'Add'}
          </button>
        </div>
        {addMember.isError && (
          <p className="text-red-400 text-xs mt-2">{(addMember.error as Error).message}</p>
        )}
      </div>

      {/* Current members */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <h3 className="text-white font-medium mb-4">Current Members</h3>
        {membersLoading ? (
          <p className="text-gray-500">Loading members...</p>
        ) : !members?.length ? (
          <p className="text-gray-500">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const isOwner = project?.ownerId === member.userId;
              return (
                <div
                  key={member.userId}
                  className="flex items-center justify-between px-4 py-3 bg-gray-800/50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm text-gray-300 font-medium">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm text-white">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      isOwner
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-gray-500/20 text-gray-400'
                    }`}>
                      {isOwner ? 'owner' : member.role}
                    </span>
                    {!isOwner && (
                      <button
                        onClick={() => removeMember.mutate(member.userId)}
                        disabled={removeMember.isPending}
                        className="text-gray-500 hover:text-red-400 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Notifications Tab ----

const NOTIFICATION_TYPES = [
  { type: 'agent_completed', label: 'Agent completed work', description: 'When an AI agent finishes a task on a ticket' },
  { type: 'ticket_moved', label: 'Ticket status changed', description: 'When a ticket moves between columns' },
  { type: 'gate_result', label: 'Gate approved/rejected', description: 'When a transition gate decision is made' },
  { type: 'comment_added', label: 'New comments', description: 'When a comment is added to a ticket' },
  { type: 'proposal_created', label: 'New ticket proposals', description: 'When new ticket proposals are generated' },
  { type: 'proposal_resolved', label: 'Proposal approved/rejected', description: 'When a proposal decision is made' },
  { type: 'scan_completed', label: 'Repo scan completed', description: 'When a repository scan finishes' },
] as const;

function NotificationsTab({ projectId }: { projectId: string }) {
  const { data, isLoading } = useNotificationPreferences(projectId);
  const updatePrefs = useUpdateNotificationPreferences(projectId);

  function handleToggle(type: string, currentlyEnabled: boolean) {
    updatePrefs.mutate({ [type]: !currentlyEnabled });
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h3 className="text-white font-medium mb-1">Notification Preferences</h3>
        <p className="text-gray-500 text-sm">
          Choose which notifications you receive for this project. All are enabled by default.
        </p>
      </div>

      <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
        {isLoading ? (
          <div className="px-5 py-8 text-center text-gray-500">Loading preferences...</div>
        ) : (
          NOTIFICATION_TYPES.map(({ type, label, description }) => {
            const enabled = data?.preferences[type] !== false;
            return (
              <div key={type} className="flex items-center justify-between px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white font-medium">{label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{description}</p>
                </div>
                <button
                  onClick={() => handleToggle(type, enabled)}
                  disabled={updatePrefs.isPending}
                  className={`relative ml-4 inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                    enabled ? 'bg-indigo-600' : 'bg-gray-700'
                  }`}
                  role="switch"
                  aria-checked={enabled}
                  aria-label={`${label} notifications`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ${
                      enabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            );
          })
        )}
      </div>

      {updatePrefs.isError && (
        <p className="text-red-400 text-sm">{(updatePrefs.error as Error).message}</p>
      )}
    </div>
  );
}

// ---- System Prompts Tab ----

function SystemPromptsTab({ projectId }: { projectId: string }) {
  const { data: prompts, isLoading } = useProjectSystemPrompts(projectId);
  const [editingId, setEditingId] = useState<string | null>(null);

  if (isLoading) {
    return <div className="text-gray-500">Loading prompts...</div>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400 mb-4">
        These system prompts control how AI agents behave. Global defaults can be overridden per project.
      </p>
      {prompts?.map((prompt) => (
        <PromptCard
          key={prompt.id}
          prompt={prompt}
          isEditing={editingId === prompt.id}
          onEdit={() => setEditingId(prompt.id)}
          onClose={() => setEditingId(null)}
        />
      ))}
      {!prompts?.length && (
        <div className="text-gray-500 text-center py-8">No system prompts configured.</div>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  isEditing,
  onEdit,
  onClose,
}: {
  prompt: SystemPrompt;
  isEditing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const updatePrompt = useUpdateSystemPrompt();
  const [content, setContent] = useState(prompt.content);
  const [name, setName] = useState(prompt.name);
  const [description, setDescription] = useState(prompt.description || '');
  const [showPreview, setShowPreview] = useState(false);

  function handleSave() {
    updatePrompt.mutate(
      { id: prompt.id, name, description, content },
      { onSuccess: onClose }
    );
  }

  function handleCancel() {
    setContent(prompt.content);
    setName(prompt.name);
    setDescription(prompt.description || '');
    onClose();
  }

  // Collapsed card — show header + description + optional preview
  if (!isEditing) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4">
          <div>
            <h3 className="text-white font-medium">{prompt.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-500 font-mono">{prompt.slug}</span>
              {!prompt.projectId && (
                <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">global</span>
              )}
              {prompt.isDefault === 1 && (
                <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">default</span>
              )}
            </div>
            {prompt.description && (
              <p className="text-sm text-gray-400 mt-1.5">{prompt.description}</p>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-4">
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`text-xs px-3 py-1.5 border rounded-lg transition-colors ${
                showPreview
                  ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/10'
                  : 'border-gray-700 text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              {showPreview ? 'Hide' : 'Preview'}
            </button>
            <button
              onClick={onEdit}
              className="text-gray-400 hover:text-white text-xs px-3 py-1.5 border border-gray-700 rounded-lg hover:border-gray-600"
            >
              Edit
            </button>
          </div>
        </div>

        {showPreview && (
          <div className="border-t border-gray-800 px-1 pb-1">
            <MarkdownEditor value={prompt.content} onChange={() => {}} readOnly minHeight="200px" />
          </div>
        )}
      </div>
    );
  }

  // Expanded editor
  return (
    <div className="bg-gray-900 border border-indigo-500/30 rounded-xl overflow-hidden shadow-lg shadow-indigo-500/5">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm font-medium focus:outline-none focus:border-indigo-500 w-64"
            placeholder="Prompt name"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 font-mono">{prompt.slug}</span>
            {!prompt.projectId && (
              <span className="text-xs bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded">global</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-4">
          <button
            onClick={handleSave}
            disabled={updatePrompt.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {updatePrompt.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            className="text-gray-400 hover:text-gray-300 px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Description */}
      <div className="px-5 py-3 border-b border-gray-800">
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-transparent border-none text-gray-300 text-sm focus:outline-none placeholder-gray-600"
          placeholder="Add a description..."
        />
      </div>

      {/* Markdown editor */}
      <MarkdownEditor value={content} onChange={setContent} minHeight="500px" />
    </div>
  );
}

// ---- Scans Tab ----

function ScansTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const latestScanRef = useRef<string | undefined>(undefined);
  const hasRunningScan = latestScanRef.current === 'running' || latestScanRef.current === 'pending';
  const { data: scans, isLoading } = useProjectScans(projectId, hasRunningScan);
  const { data: prompts } = useProjectSystemPrompts(projectId);
  const triggerScan = useTriggerScan(projectId);
  const [selectedPromptId, setSelectedPromptId] = useState<string>('');

  const latestScan = scans?.[0];

  // Track scan status transitions — invalidate knowledge when scan completes
  useEffect(() => {
    const prev = latestScanRef.current;
    latestScanRef.current = latestScan?.status;
    if ((prev === 'running' || prev === 'pending') && latestScan?.status === 'completed') {
      qc.invalidateQueries({ queryKey: ['knowledge', projectId] });
    }
  }, [latestScan?.status, projectId, qc]);

  const scannerPrompt = prompts?.find((p) => p.slug === 'repo-scanner');

  function handleTrigger() {
    triggerScan.mutate(selectedPromptId || scannerPrompt?.id);
  }

  return (
    <div className="space-y-6">
      {/* Trigger scan */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-white font-medium mb-2">Run Repo Scan</h3>
        <p className="text-sm text-gray-400 mb-4">
          Scan the repository to generate knowledge files that AI agents use for context.
        </p>
        <div className="flex items-center gap-3">
          <select
            value={selectedPromptId}
            onChange={(e) => setSelectedPromptId(e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
          >
            <option value="">Default (repo-scanner)</option>
            {prompts?.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button
            onClick={handleTrigger}
            disabled={triggerScan.isPending}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          >
            {triggerScan.isPending ? 'Starting...' : 'Start Scan'}
          </button>
        </div>
        {triggerScan.isError && (
          <p className="text-red-400 text-sm mt-2">{(triggerScan.error as Error).message}</p>
        )}
        {triggerScan.isSuccess && (
          <p className="text-green-400 text-sm mt-2">Scan started successfully.</p>
        )}
      </div>

      {/* Scan history */}
      <div>
        <h3 className="text-white font-medium mb-3">Scan History</h3>
        {isLoading ? (
          <div className="text-gray-500">Loading scans...</div>
        ) : !scans?.length ? (
          <div className="text-gray-500 text-center py-8">No scans have been run yet.</div>
        ) : (
          <div className="space-y-2">
            {scans.map((scan) => (
              <ScanRow key={scan.id} scan={scan} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ScanRow({ scan }: { scan: ProjectScan }) {
  const [expanded, setExpanded] = useState(false);

  const statusColors: Record<string, string> = {
    pending: 'bg-gray-500/20 text-gray-400',
    running: 'bg-blue-500/20 text-blue-400',
    completed: 'bg-green-500/20 text-green-400',
    failed: 'bg-red-500/20 text-red-400',
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[scan.status] || statusColors.pending}`}>
            {scan.status}
          </span>
          <span className="text-sm text-gray-300">
            {new Date(scan.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {scan.outputFiles?.length > 0 && (
            <span className="text-xs text-gray-500">{scan.outputFiles.length} files</span>
          )}
          <span className="text-gray-600 text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800">
          {scan.outputSummary && (
            <div className="mt-3 max-h-80 overflow-auto rounded-lg bg-gray-950 border border-gray-800">
              <pre className="p-4 text-xs text-gray-300 font-mono whitespace-pre-wrap break-words leading-relaxed">
                {scan.outputSummary}
              </pre>
            </div>
          )}
          {scan.outputFiles?.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Generated files:</p>
              <div className="flex flex-wrap gap-1">
                {scan.outputFiles.map((f) => (
                  <span key={f} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded font-mono">{f}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Knowledge Files Tab ----

const LIVING_DOC_FILES = new Set(['memories.md', 'project-learnings.md']);

function KnowledgeTab({ projectId }: { projectId: string }) {
  const { data: files, isLoading } = useKnowledgeFiles(projectId);
  const [selectedFile, setSelectedFile] = useState<string>('');

  if (isLoading) {
    return <div className="text-gray-500">Loading knowledge files...</div>;
  }

  const livingDocs = files?.filter((f) => LIVING_DOC_FILES.has(f.filename)) || [];
  const scanFiles = files?.filter((f) => !LIVING_DOC_FILES.has(f.filename)) || [];

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-400">
        Knowledge files are generated by repo scans and used by AI agents as context.
      </p>

      {/* Living Documents */}
      {livingDocs.length > 0 && (
        <div>
          <h3 className="text-white font-medium mb-2">Living Documents</h3>
          <p className="text-xs text-gray-500 mb-3">
            Shared memory that agents read and append to over time. Persists across sessions.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {livingDocs.map((f) => (
              <button
                key={f.filename}
                onClick={() => setSelectedFile(f.filename)}
                className={`text-left px-4 py-3 rounded-xl border transition-colors ${
                  selectedFile === f.filename
                    ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                    : 'bg-gray-900 border-gray-800 text-gray-300 hover:border-gray-700'
                }`}
              >
                <span className="text-sm font-mono">{f.filename}</span>
                <p className="text-xs text-gray-500 mt-1">
                  {f.filename === 'memories.md'
                    ? 'Discoveries, decisions, and context from agent sessions'
                    : 'Technical gotchas and patterns not obvious from code'}
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Scan-generated files */}
      {!files?.length ? (
        <div className="text-gray-500 text-center py-8">
          No knowledge files yet. Run a repo scan to generate them.
        </div>
      ) : (
        <>
          {scanFiles.length > 0 && (
            <div>
              <h3 className="text-white font-medium mb-3">Scan Knowledge</h3>
              <div className="grid grid-cols-4 gap-4">
                {/* File list */}
                <div className="col-span-1 space-y-1">
                  {scanFiles.map((f) => (
                    <button
                      key={f.filename}
                      onClick={() => setSelectedFile(f.filename)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm font-mono ${
                        selectedFile === f.filename
                          ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30'
                          : 'text-gray-400 hover:bg-gray-900 hover:text-gray-300'
                      }`}
                    >
                      {f.filename}
                    </button>
                  ))}
                </div>

                {/* File content */}
                <div className="col-span-3">
                  {selectedFile && !LIVING_DOC_FILES.has(selectedFile) ? (
                    <KnowledgeFileViewer projectId={projectId} filename={selectedFile} />
                  ) : !selectedFile || LIVING_DOC_FILES.has(selectedFile) ? null : (
                    <div className="text-gray-500 text-center py-16">
                      Select a file to view its contents.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Viewer for living docs (shown below the cards when selected) */}
          {selectedFile && LIVING_DOC_FILES.has(selectedFile) && (
            <KnowledgeFileViewer projectId={projectId} filename={selectedFile} />
          )}
        </>
      )}
    </div>
  );
}

function KnowledgeFileViewer({ projectId, filename }: { projectId: string; filename: string }) {
  const { data, isLoading } = useKnowledgeFile(projectId, filename);

  if (isLoading) {
    return <div className="text-gray-500 p-4">Loading...</div>;
  }

  return (
    <MarkdownEditor
      value={data?.content || ''}
      onChange={() => {}}
      readOnly
      minHeight="400px"
    />
  );
}

// ---- Agent Models Tab ----

const PERSONAS = [
  { id: 'implementer', name: 'Implementer', phase: 'execution', defaultModel: 'opus', description: 'Writes code, creates PRs, addresses review feedback' },
  { id: 'reviewer', name: 'Reviewer', phase: 'execution', defaultModel: 'opus', description: 'Code review, quality gates' },
  { id: 'qa_tester', name: 'QA Tester', phase: 'execution', defaultModel: 'sonnet', description: 'Runs tests, verifies acceptance criteria' },
  { id: 'acceptance_validator', name: 'Acceptance Validator', phase: 'execution', defaultModel: 'opus', description: 'Final check against original requirements' },
  { id: 'planner', name: 'Planner', phase: 'planning', defaultModel: 'opus', description: 'Orchestrates planning, synthesizes feature plans' },
  { id: 'developer', name: 'Developer Analyst', phase: 'planning', defaultModel: 'sonnet', description: 'Architecture and implementation analysis' },
  { id: 'product', name: 'Product Analyst', phase: 'planning', defaultModel: 'sonnet', description: 'User stories, acceptance criteria' },
  { id: 'qa', name: 'QA Analyst', phase: 'planning', defaultModel: 'sonnet', description: 'Test strategy, edge cases' },
  { id: 'researcher', name: 'Researcher', phase: 'planning', defaultModel: 'opus', description: 'Prior art, library recommendations' },
  { id: 'business_rules', name: 'Business Rules', phase: 'planning', defaultModel: 'sonnet', description: 'Domain logic, validation rules' },
  { id: 'repo_scanner', name: 'Repo Scanner', phase: 'planning', defaultModel: 'sonnet', description: 'Analyzes repo structure and conventions' },
] as const;

const MODEL_OPTIONS = ['opus', 'sonnet', 'haiku'] as const;

const MODEL_COLORS: Record<string, string> = {
  opus: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  sonnet: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  haiku: 'bg-green-500/20 text-green-300 border-green-500/30',
};

function AgentModelsTab({ projectId }: { projectId: string }) {
  const { data: project } = useProject(projectId);
  const updateProject = useUpdateProject(projectId);
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (project?.personaModelOverrides) {
      setOverrides(project.personaModelOverrides);
      setDirty(false);
    }
  }, [project?.personaModelOverrides]);

  function handleChange(personaId: string, model: string) {
    const defaultModel = PERSONAS.find(p => p.id === personaId)?.defaultModel || 'sonnet';
    setOverrides(prev => {
      const next = { ...prev };
      if (model === defaultModel) {
        delete next[personaId];
      } else {
        next[personaId] = model;
      }
      return next;
    });
    setDirty(true);
  }

  function handleSave() {
    updateProject.mutate({ personaModelOverrides: overrides }, {
      onSuccess: () => setDirty(false),
    });
  }

  function handleReset() {
    setOverrides(project?.personaModelOverrides || {});
    setDirty(false);
  }

  const executionPersonas = PERSONAS.filter(p => p.phase === 'execution');
  const planningPersonas = PERSONAS.filter(p => p.phase === 'planning');

  function renderPersonaRow(persona: typeof PERSONAS[number]) {
    const effectiveModel = overrides[persona.id] || persona.defaultModel;
    const isOverridden = persona.id in overrides;

    return (
      <div key={persona.id} className="flex items-center justify-between py-3 px-4 rounded-lg bg-gray-800/50 border border-gray-700/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-white text-sm font-medium">{persona.name}</span>
            {isOverridden && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                overridden
              </span>
            )}
          </div>
          <p className="text-gray-500 text-xs mt-0.5">{persona.description}</p>
        </div>
        <div className="flex items-center gap-2 ml-4">
          {MODEL_OPTIONS.map(model => (
            <button
              key={model}
              onClick={() => handleChange(persona.id, model)}
              className={`px-3 py-1 text-xs font-medium rounded-md border transition-all ${
                effectiveModel === model
                  ? MODEL_COLORS[model]
                  : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600 hover:text-gray-400'
              }`}
            >
              {model}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h3 className="text-white font-medium mb-1">Agent Model Configuration</h3>
        <p className="text-gray-500 text-sm">
          Override the default model for each persona in this project. Changes affect new agent sessions only.
        </p>
      </div>

      {/* Execution Personas */}
      <div>
        <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Execution Agents</h4>
        <div className="space-y-2">
          {executionPersonas.map(renderPersonaRow)}
        </div>
      </div>

      {/* Planning Personas */}
      <div>
        <h4 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Planning Agents</h4>
        <div className="space-y-2">
          {planningPersonas.map(renderPersonaRow)}
        </div>
      </div>

      {/* Save bar */}
      {dirty && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
          <span className="text-indigo-300 text-sm flex-1">Unsaved changes</span>
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Discard
          </button>
          <button
            onClick={handleSave}
            disabled={updateProject.isPending}
            className="px-4 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            {updateProject.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
}
