import React, { useEffect, useState } from 'react';
import { useProjectStore, Project } from '../../store/projectStore';
import { useAuthStore } from '../../store/authStore';
import { api } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  Folder,
  MessageSquare,
  Sparkles,
  Plus,
  Github,
  Zap,
  BarChart3,
  Calendar,
  Layers,
  Search,
  Settings as SettingsIcon,
  LogOut,
  User as UserIcon,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DashboardProps {
  onSelectProject: (projectId: string) => void;
  onNavigateToSettings: () => void;
  onNavigateToProfile: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onSelectProject,
  onNavigateToSettings,
  onNavigateToProfile,
}) => {
  const { user, logout } = useAuthStore();
  const { projects, setProjects, setActiveProject } = useProjectStore();
  
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);

  // Form states
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectLang, setProjectLang] = useState('TypeScript');
  const [repoUrl, setRepoUrl] = useState('');
  const [repoBranch, setRepoBranch] = useState('main');
  const [cloneLoading, setCloneLoading] = useState(false);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch projects on load
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/projects');
        setProjects(response.data.data.projects);
      } catch (err) {
        console.error('Failed to load projects', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, [setProjects]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      const response = await api.post('/projects', {
        name: projectName,
        description: projectDesc,
        language: projectLang,
      });
      const newProj = response.data.data.project;
      setProjects([newProj, ...projects]);
      setShowCreateModal(false);
      setProjectName('');
      setProjectDesc('');
      
      // Auto-open created project workspace
      setActiveProject(newProj);
      onSelectProject(newProj.id);
    } catch (err) {
      console.error('Failed to create project', err);
    }
  };

  const handleCloneRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim()) return;

    setCloneLoading(true);
    try {
      // 1. Create a dummy project container for repo
      const repoName = repoUrl.split('/').pop()?.replace('.git', '') || 'GitHub Project';
      const projectRes = await api.post('/projects', {
        name: repoName,
        description: `Repository clone of ${repoUrl}`,
        language: 'TypeScript',
      });
      const newProj = projectRes.data.data.project;
      setProjects([newProj, ...projects]);

      // 2. Trigger asynchronous clone & indexing analysis
      await api.post(`/github/projects/${newProj.id}/analyze`, {
        url: repoUrl,
        branch: repoBranch,
      });

      setShowCloneModal(false);
      setRepoUrl('');
      
      // Go to project workspace
      setActiveProject(newProj);
      onSelectProject(newProj.id);
    } catch (err) {
      console.error('Failed to clone repository', err);
    } finally {
      setCloneLoading(false);
    }
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.language.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-background">
      {/* Dynamic Left Navigation Bar */}
      <aside className="hidden w-64 border-r border-border bg-card p-6 md:flex md:flex-col justify-between">
        <div className="space-y-8">
          <div className="flex items-center space-x-2 text-primary font-bold text-lg">
            <Sparkles className="h-6 w-6 animate-pulse" />
            <span>CODECOACH AI</span>
          </div>

          <nav className="space-y-1">
            <button className="flex w-full items-center space-x-3 rounded-lg bg-primary/10 px-3.5 py-2.5 text-sm font-semibold text-primary">
              <Layers className="h-4 w-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={onNavigateToProfile}
              className="flex w-full items-center space-x-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <UserIcon className="h-4 w-4" />
              <span>Profile</span>
            </button>

            <button
              onClick={onNavigateToSettings}
              className="flex w-full items-center space-x-3 rounded-lg px-3.5 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              <SettingsIcon className="h-4 w-4" />
              <span>Settings</span>
            </button>
          </nav>
        </div>

        <div className="border-t border-border pt-4">
          <div className="mb-4 flex items-center space-x-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 text-primary font-semibold text-sm">
              {user?.name.slice(0, 2).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center space-x-2 text-xs font-bold uppercase tracking-wider text-destructive hover:text-destructive/80 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground">
              Hello, {user?.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              Manage your software projects and trigger intelligent codebase audits.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowCloneModal(true)}>
              <Github className="mr-1.5 h-4 w-4" /> Clone Repository
            </Button>

            <Button variant="primary" size="sm" onClick={() => setShowCreateModal(true)}>
              <Plus className="mr-1.5 h-4 w-4" /> New Project
            </Button>
          </div>
        </header>

        {/* AI Analytics Cards Section */}
        <section className="mb-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Total Projects', val: projects.length, icon: Folder, color: 'text-blue-500' },
            { label: 'Active Chats', val: projects.length * 2, icon: MessageSquare, color: 'text-emerald-500' },
            { label: 'Tokens Ingested', val: '4.8M', icon: Zap, color: 'text-yellow-500' },
            { label: 'Code Quality Avg', val: '86%', icon: BarChart3, color: 'text-violet-500' },
          ].map((card, idx) => (
            <motion.div
              whileHover={{ y: -4 }}
              key={idx}
              className="rounded-xl border border-border bg-card p-6 shadow-sm flex items-center justify-between"
            >
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {card.label}
                </p>
                <h3 className="mt-1 text-2xl font-extrabold text-foreground">{card.val}</h3>
              </div>
              <div className={`p-3 rounded-lg bg-muted ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
            </motion.div>
          ))}
        </section>

        {/* Search and Project Grid Section */}
        <section className="space-y-6">
          <div className="flex items-center space-x-3 rounded-lg border border-border bg-card px-3.5 py-1 max-w-md shadow-sm">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          <h2 className="text-lg font-bold text-foreground">Recent Projects</h2>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-48 animate-pulse rounded-xl border border-border bg-muted/20" />
              ))}
            </div>
          ) : filteredProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-12 text-center">
              <Folder className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-4 text-lg font-semibold text-foreground">No projects found</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Get started by creating a new project or cloning a repository.
              </p>
              <Button
                variant="primary"
                size="sm"
                className="mt-6"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="mr-1.5 h-4 w-4" /> Create First Project
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => (
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  key={project.id}
                  onClick={() => {
                    setActiveProject(project);
                    onSelectProject(project.id);
                  }}
                  className="group relative cursor-pointer rounded-xl border border-border bg-card p-6 shadow-sm transition-all hover:border-primary/50"
                >
                  <div className="flex justify-between items-start">
                    <div className="rounded-lg bg-primary/10 p-2.5 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-200">
                      <Folder className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold uppercase px-2 py-0.5 rounded bg-muted text-muted-foreground">
                      {project.language}
                    </span>
                  </div>

                  <h3 className="mt-4 text-lg font-bold text-foreground group-hover:text-primary transition-colors">
                    {project.name}
                  </h3>
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                    {project.description || 'No description provided.'}
                  </p>

                  <div className="mt-6 flex items-center text-xs text-muted-foreground space-x-1 border-t border-border pt-4">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>Updated {new Date(project.updatedAt).toLocaleDateString()}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>
      </main>

      {/* CREATE PROJECT MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-foreground mb-4">Create New Project</h3>
              <form onSubmit={handleCreateProject} className="space-y-4">
                <Input
                  label="Project Name"
                  placeholder="e.g. My Website"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  required
                />
                <Input
                  label="Description"
                  placeholder="Optional description"
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                />
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Primary Language
                  </label>
                  <select
                    value={projectLang}
                    onChange={(e) => setProjectLang(e.target.value)}
                    className="w-full h-10 rounded-lg border border-input bg-card px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary text-foreground"
                  >
                    {['TypeScript', 'JavaScript', 'Python', 'Go', 'Rust', 'Java', 'C++', 'SQL'].map(
                      (l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button variant="outline" type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit">
                    Create Project
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CLONE REPOSITORY MODAL */}
      <AnimatePresence>
        {showCloneModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <h3 className="text-xl font-bold text-foreground mb-4">Clone GitHub Repository</h3>
              <form onSubmit={handleCloneRepo} className="space-y-4">
                <Input
                  label="Repository URL"
                  placeholder="https://github.com/username/repo"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  required
                />
                <Input
                  label="Branch"
                  placeholder="main"
                  value={repoBranch}
                  onChange={(e) => setRepoBranch(e.target.value)}
                />

                <div className="flex justify-end gap-3 pt-4 border-t border-border">
                  <Button variant="outline" type="button" onClick={() => setShowCloneModal(false)}>
                    Cancel
                  </Button>
                  <Button variant="primary" type="submit" isLoading={cloneLoading}>
                    Clone & Audit
                  </Button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
