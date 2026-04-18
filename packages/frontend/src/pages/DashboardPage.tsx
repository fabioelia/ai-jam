import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../api/queries.js';
import { useCreateProject } from '../api/mutations.js';
import { useAuthStore } from '../stores/auth-store.js';
import { ProjectCardSkeleton } from '../components/common/Skeleton.js';
import { toast } from '../stores/toast-store.js';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { data: projects, isLoading } = useProjects();
  const createProject = useCreateProject();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [localPath, setLocalPath] = useState('');
  const [sourceType, setSourceType] = useState<'repo' | 'local'>('repo');
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Keyboard: Escape to close form
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showCreate) {
        setShowCreate(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showCreate]);

  // Focus name input when showing form
  useEffect(() => {
    if (showCreate) {
      nameInputRef.current?.focus();
    }
  }, [showCreate]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const data: { name: string; repoUrl?: string; localPath?: string; supportWorktrees?: boolean } = { name };
    if (sourceType === 'repo') {
      data.repoUrl = repoUrl;
    } else {
      data.localPath = localPath;
      data.supportWorktrees = false;
    }
    try {
      await createProject.mutateAsync(data);
      toast.success(`Project "${name}" created successfully`);
      setShowCreate(false);
      setName('');
      setRepoUrl('');
      setLocalPath('');
    } catch (error) {
      toast.error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 bg-gray-900">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">AI Jam</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <button onClick={logout} className="text-gray-500 hover:text-gray-300 text-sm">
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Projects</h2>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            New Project
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6 space-y-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">Project Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                placeholder="My Awesome App"
                required
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-2">Source</label>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setSourceType('repo')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sourceType === 'repo'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Repository URL
                </button>
                <button
                  type="button"
                  onClick={() => setSourceType('local')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    sourceType === 'local'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-gray-300'
                  }`}
                >
                  Local Directory
                </button>
              </div>
              {sourceType === 'repo' ? (
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                  placeholder="https://github.com/org/repo or owner/repo"
                  required
                />
              ) : (
                <>
                  <input
                    type="text"
                    value={localPath}
                    onChange={(e) => setLocalPath(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500"
                    placeholder="/path/to/your/project"
                    required
                  />
                  <p className="text-xs text-gray-500 mt-1">Absolute path to a local git repository. Worktrees will be disabled — one feature at a time.</p>
                </>
              )}
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium">
                Create
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-300 px-4 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        )}

        {isLoading ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
            <ProjectCardSkeleton />
          </div>
        ) : !projects?.length ? (
          <div className="text-center py-16">
            <p className="text-gray-500 mb-4">No projects yet. Create one to get started.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors"
              >
                <button
                  onClick={() => navigate(`/projects/${project.id}/board`)}
                  className="text-left w-full"
                >
                  <h3 className="text-white font-medium mb-1">{project.name}</h3>
                  <p className="text-gray-500 text-sm truncate">{project.repoUrl || project.localPath}</p>
                  <p className="text-gray-600 text-xs mt-2">
                    {project.localPath ? 'Local' : 'Branch: ' + project.defaultBranch}
                  </p>
                </button>
                <div className="flex gap-2 mt-4 pt-3 border-t border-gray-800">
                  <button
                    onClick={() => navigate(`/projects/${project.id}/board`)}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    Board
                  </button>
                  <span className="text-gray-700">|</span>
                  <button
                    onClick={() => navigate(`/projects/${project.id}/settings`)}
                    className="text-xs text-gray-400 hover:text-gray-300"
                  >
                    Settings
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
