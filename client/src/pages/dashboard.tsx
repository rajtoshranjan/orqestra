import { useState } from 'react';
import { Plus, FolderOpen, Trash2, Layers, Clock, Search } from 'lucide-react';

import { formatRelativeTime } from '@/utils';
import { useProjects, useDeleteProject } from '@/api';
import { registry } from '@/services';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from '@/components/ui';

type DashboardProps = {
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
};

export function Dashboard({ onOpenProject, onNewProject }: DashboardProps) {
  const { data: projects = [], isLoading } = useProjects();
  const deleteProjectMutation = useDeleteProject();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  /* Search & Filter States */
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'saved' | 'resources' | 'name'>('saved');

  const deleteProject = (projectId: string) => {
    deleteProjectMutation.mutate(projectId);
  };

  /* Filter and Sort logic for Projects */
  const filteredProjects = projects
    .filter((project) => {
      const query = searchQuery.trim().toLowerCase();
      if (!query) return true;
      return (
        project.projectName.toLowerCase().includes(query) ||
        (project.projectDescription &&
          project.projectDescription.toLowerCase().includes(query))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'name') {
        return a.projectName.localeCompare(b.projectName);
      }
      if (sortBy === 'resources') {
        return (b.nodes?.length ?? 0) - (a.nodes?.length ?? 0);
      }
      // default: 'saved' (last saved first)
      const dateA = a.lastSavedAt ?? '';
      const dateB = b.lastSavedAt ?? '';
      return dateB.localeCompare(dateA);
    });

  /* Render */
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background font-sans text-foreground">
      {/* Top Header Navigation */}
      <nav className="z-25 relative flex h-11 shrink-0 select-none items-center justify-between border-b border-border bg-card px-4">
        {/* Left — Logo emblem + branding */}
        <div className="flex items-center gap-2">
          <div className="flex size-5 items-center justify-center rounded bg-gradient-to-tr from-primary to-accent shadow-sm">
            <Layers className="size-3 font-extrabold text-primary-foreground" />
          </div>
          <span className="bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text font-sans text-xs font-bold tracking-tight text-foreground text-transparent">
            Orqestra
          </span>
          <span className="ml-1 inline-flex h-4 items-center rounded border border-primary/20 bg-primary/10 px-1.5 text-[8px] font-bold uppercase tracking-wider text-primary">
            PRO TIER
          </span>
        </div>

        {/* Right — Profile initials avatar */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 items-center justify-center rounded-full border border-border bg-accent text-[10px] font-bold text-accent-foreground shadow-inner">
            DT
          </div>
        </div>
      </nav>

      {/* Main Content Pane */}
      <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col overflow-y-auto bg-background px-8 py-10">
        {/* Elegant Backdrop Ambient Glow */}
        <div className="pointer-events-none absolute left-1/2 top-0 z-0 h-[350px] w-[600px] -translate-x-1/2 rounded-full bg-primary/10 opacity-30 blur-[130px]" />

        {/* Projects Hero Header */}
        <div className="animate-fade-in relative z-10 flex w-full shrink-0 select-none items-center justify-between pb-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-foreground">
              Your Projects
              {projects.length > 0 && (
                <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-accent px-2 font-mono text-[10px] font-bold text-accent-foreground">
                  {projects.length}
                </span>
              )}
            </h1>
            <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-muted-foreground">
              Design, validate, and deploy secure cloud architectures directly
              on a visual, interactive canvas.
            </p>
          </div>
        </div>

        {/* Main Grid View */}
        <div className="relative z-10 mt-6 w-full flex-1">
          {isLoading ? (
            /* Loading Skeletons */
            <LoadingState variant="skeleton-grid" count={3} />
          ) : projects.length > 0 ? (
            <div className="space-y-6">
              {/* Search, Sorting, and Add Project Actions Row */}
              <div className="animate-fade-in flex select-none flex-wrap items-center justify-between gap-4">
                {/* Left Metadata Indicator */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Projects List
                  </span>
                  <div className="size-1 rounded-full bg-zinc-700" />
                  <span className="text-[11px] text-zinc-500">
                    Sorted by{' '}
                    {sortBy === 'saved'
                      ? 'last saved'
                      : sortBy === 'resources'
                        ? 'resources'
                        : 'alphabetical'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Search Field */}
                  <div className="group relative">
                    <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-primary">
                      <Search className="size-3.5" />
                    </span>
                    <input
                      type="text"
                      placeholder="Search projects..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-8 w-44 rounded-md border border-zinc-800/80 bg-zinc-950/40 pl-8 pr-2.5 text-xs text-foreground transition-all duration-200 placeholder:text-zinc-500 focus:border-primary/50 focus:bg-zinc-950/80 focus:outline-none focus:ring-1 focus:ring-primary/20 sm:w-56"
                    />
                  </div>

                  {/* Sort Selector */}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="h-8 cursor-pointer rounded-md border border-zinc-800/80 bg-zinc-950/40 px-2 text-xs text-foreground transition-all duration-200 hover:border-zinc-700/80 focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/20"
                  >
                    <option value="saved" className="bg-card">
                      Last Saved
                    </option>
                    <option value="resources" className="bg-card">
                      Most Resources
                    </option>
                    <option value="name" className="bg-card">
                      Alphabetical
                    </option>
                  </select>

                  {/* Create Project Button */}
                  <Button
                    type="button"
                    onClick={onNewProject}
                    className="flex h-8 items-center gap-1 rounded-md border border-primary/35 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20"
                  >
                    <Plus className="size-3.5" />
                    New Project
                  </Button>
                </div>
              </div>

              {/* Spacious 3-Column Projects Card Grid */}
              <div className="stagger-children grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProjects.map((project) => {
                  /* Extract unique AWS services used in this project nodes list */
                  const projectServices = (project.nodes || [])
                    .map((node) => registry.find(node.data?.serviceId))
                    .filter((s): s is NonNullable<typeof s> => !!s)
                    .filter(
                      (service, idx, self) =>
                        self.findIndex((s) => s.id === service.id) === idx,
                    );

                  return (
                    <Card
                      key={project.projectId}
                      onClick={() => onOpenProject(project.projectId)}
                      className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-zinc-800/60 bg-zinc-900/15 p-5 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/35 hover:bg-zinc-900/35 hover:shadow-[0_8px_30px_rgba(99,102,241,0.05)]"
                    >
                      <div className="space-y-4">
                        {/* Card Header: Title & Project Status */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-1">
                            <h3 className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
                              {project.projectName}
                            </h3>
                            <p className="mt-2 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-zinc-400">
                              {project.projectDescription ||
                                'No description provided.'}
                            </p>
                          </div>

                          {/* Service Icons Array on the top-right, clean and minimal */}
                          {projectServices.length > 0 && (
                            <div className="flex shrink-0 items-center gap-1 rounded-md border border-zinc-800 bg-zinc-950/60 p-1 transition-all duration-300 group-hover:border-zinc-700/60 group-hover:bg-zinc-950">
                              {projectServices.map((service) => {
                                const ServiceIcon = service.icon;
                                return (
                                  <div
                                    key={service.id}
                                    className="flex size-6 shrink-0 items-center justify-center rounded border border-zinc-800 bg-zinc-900 text-zinc-400 transition-all duration-300 group-hover:border-zinc-700 group-hover:text-zinc-200"
                                    title={service.name}
                                  >
                                    <ServiceIcon
                                      size={12}
                                      className="font-bold"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Stats row */}
                        <div className="flex flex-wrap items-center gap-2 text-[10px]">
                          <span className="inline-flex select-none items-center gap-1.5 rounded border border-zinc-700/50 bg-zinc-900/50 px-2 py-0.5 font-mono font-bold text-zinc-300 transition-all duration-300 group-hover:border-zinc-700/70 group-hover:bg-zinc-800/50">
                            <span className="size-1.5 animate-pulse rounded-full bg-primary/70" />
                            <Layers className="size-2.5 text-zinc-400" />
                            {project.nodes.length} resource
                            {project.nodes.length !== 1 ? 's' : ''}
                          </span>
                          <span className="inline-flex select-none items-center gap-1.5 rounded border border-zinc-700/50 bg-zinc-900/50 px-2 py-0.5 font-bold text-zinc-300 transition-all duration-300 group-hover:border-zinc-700/70 group-hover:bg-zinc-800/50">
                            <span className="pulse-green size-1.5 rounded-full bg-emerald-500/80" />
                            <Clock className="size-2.5 text-zinc-400" />
                            {formatRelativeTime(
                              project.lastSavedAt || new Date().toISOString(),
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Bottom Actions Row */}
                      <div className="mt-5 flex select-none items-center justify-between border-t border-border/10 pt-3">
                        <span className="inline-flex h-7 items-center gap-1.5 rounded border border-zinc-700/60 bg-zinc-800/20 px-3 text-[11px] font-semibold text-zinc-300 shadow-sm transition-all duration-300 ease-out group-hover:border-transparent group-hover:bg-primary group-hover:text-primary-foreground group-hover:shadow-sm group-hover:shadow-primary/20">
                          <FolderOpen className="size-3.5 text-zinc-400 transition-colors duration-300 group-hover:text-primary-foreground" />
                          Configure Project
                        </span>

                        <Button
                          variant="ghost"
                          size="icon"
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setProjectToDelete(project.projectId);
                            setConfirmOpen(true);
                          }}
                          className="size-7 rounded text-muted-foreground opacity-45 transition-all duration-200 hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          aria-label={`Delete ${project.projectName}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Empty Projects State */
            <div className="animate-fade-in mt-4">
              <EmptyState
                title="No projects found"
                description="Get started by creating a new visual architecture project from scratch."
                icon={FolderOpen}
                actionText="Create Project"
                onAction={onNewProject}
                className="rounded-xl border border-dashed border-border bg-card/10 py-16"
              />
            </div>
          )}
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete Project"
        description="Are you sure you want to delete this project? This will permanently delete the project workspace and all configuration settings from the server. This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={() => {
          if (projectToDelete) {
            deleteProject(projectToDelete);
            setProjectToDelete(null);
          }
        }}
      />
    </div>
  );
}
