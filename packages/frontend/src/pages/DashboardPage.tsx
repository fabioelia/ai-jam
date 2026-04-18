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
    <div className="min-h-screen bg-gray-950 flex flex flex-col">
      <header className="border-b border-gray-800 bg-gray-900 shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">AI Jam</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-400 text-sm">{user?.name}</span>
            <button
              onClick={logout}
              className="text-gray-500 hover:text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg text-sm transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Projects</h2>
            <p className="text-gray-500 text-sm">
              {projects?.length || 0} {projects?.length === 1 ? 'project' : 'projects'}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-2 shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Project
          </button>
        </div>

        {showCreate && (
          <form onSubmit={handleCreate} className="bg-gray-900 border border-gray-700 rounded-2xl p-6 mb-8 shadow-xl animate-in slide-in-from-bottom">
            <div>
              <h3 className="text-white text-lg font-semibold mb-1">Create New Project</h3>
              <p className="text-gray-500 text-sm">Set up a workspace for planning and executing features with AI agents.</p>
            </div>
            <div className="space-y-5 mt-6">
              <div>
                <label htmlFor="project-name" className="block text-sm font-medium text-gray-300 mb-2">Project Name</label>
                <input
                  ref={nameInputRef}
                  id="project-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  placeholder="e.g., My Awesome App"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Source</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSourceType('repo')}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                      sourceType === 'repo'
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4m-14-10v7a2 2 0 002 2h14a2 2 0 002-2v-7a2 2 0 00-2-2z" />
                    </svg>
                    Repository URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceType('local')}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 ${
                      sourceType === 'local'
                        ? 'bg-ind                    600 text-white shadow-lg shadow-indigo-500/20'
                        : 'bg-gray-800 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2 2H5a2 2 0 00-2 2z" />
                    </svg>
                    Local Directory
                  </button>
                </div>
                {sourceType === 'repo' ? (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={repoUrl}
                      onChange={(e) => setRepoUrl(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      placeholder="https://github.com/owner/repo"
                      required
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Supports GitHub repositories. The repository will be cloned locally for agent access.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3">
                    <input
                      type="text"
                      value={localPath}
                      onChange={(e) => setLocalPath(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      placeholder="/path/to/your/project"
                      required
                    />
                    <p className="text-xs text-gray-600 mt-2">
                      Absolute path to a local git repository. <span className="text-yellow-500">Worktrees will be disabled</span> — one feature at a time.
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-gray-800">
              <button
                type="submit"
                disabled={!name.trim() || (sourceType === 'repo' && !repoUrl.trim()) || (sourceType === 'local' && !localPath.trim())}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center gap-2"
              >
                Create Project
              </button>
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="text-gray-400 hover:text-gray-300 px-5 py-2.5 rounded-xl text-sm transition-colors hover:bg-gray-800"
              >
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
