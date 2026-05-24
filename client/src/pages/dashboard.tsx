import { useState } from 'react';
import { Plus, FolderOpen, Trash2, Layers, Clock } from 'lucide-react';

import { formatRelativeTime } from '@/utils';
import { useProjects, useDeleteProject } from '@/lib/api';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  ConfirmDialog,
} from '@/components/ui';

interface DashboardProps {
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
}

export function Dashboard({ onOpenProject, onNewProject }: DashboardProps) {
  const { data: projects = [], isLoading } = useProjects();
  const deleteProjectMutation = useDeleteProject();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);

  const deleteProject = (projectId: string) => {
    deleteProjectMutation.mutate(projectId);
  };

  /* ── Computed stats ─────────────────────────────────────────────────── */
  const totalProjects = projects.length;
  const totalResources = projects.reduce(
    (sum, p) => sum + (p.nodes?.length ?? 0),
    0,
  );

  const lastActive =
    projects.length > 0
      ? formatRelativeTime(
          [...projects]
            .filter((p) => p.lastSavedAt)
            .sort((a, b) =>
              (b.lastSavedAt ?? '').localeCompare(a.lastSavedAt ?? ''),
            )[0]?.lastSavedAt ?? new Date().toISOString(),
        )
      : 'Never';

  /* ── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Top Navigation ────────────────────────────────────────────── */}
      <nav className="bg-card/45 flex h-11 items-center justify-between border-b border-border px-4 backdrop-blur-sm">
        {/* Left — logo + app name */}
        <div className="flex items-center">
          <span className="select-none font-sans text-sm font-bold tracking-tight text-foreground">
            Orqestra
          </span>
        </div>

        {/* Right — New Project + avatar */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={onNewProject}
            size="sm"
            className="flex items-center gap-1.5"
          >
            <Plus className="size-3.5" />
            New Project
          </Button>

          <div className="flex size-7 items-center justify-center rounded-full bg-accent text-[10px] font-semibold text-accent-foreground">
            DT
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <div className="animate-fade-in mx-auto max-w-6xl px-8 py-12">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Your Workspaces
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          Design, validate, and deploy cloud architectures
        </p>

        {/* Stats row */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total Projects */}
          <Card className="border-border/80 bg-card/50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Total Projects
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {totalProjects}
            </p>
          </Card>

          {/* Total Resources */}
          <Card className="border-border/80 bg-card/50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Total Resources
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {totalResources}
            </p>
          </Card>

          {/* Last Active */}
          <Card className="border-border/80 bg-card/50 px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Last Active
            </p>
            <p className="mt-2 text-2xl font-bold text-foreground">
              {lastActive}
            </p>
          </Card>
        </div>
      </div>

      {/* ── Projects Grid / Empty State ───────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-8 pb-16">
        {isLoading ? (
          /* ── Skeleton Grid ── */
          <LoadingState variant="skeleton-grid" count={3} />
        ) : projects.length > 0 ? (
          <>
            {/* Section header */}
            <div className="mb-6 flex items-center gap-3">
              <h2 className="text-lg font-semibold text-foreground">
                Projects
              </h2>
              <span className="bg-accent/20 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-2 text-[10px] font-semibold text-primary">
                {projects.length}
              </span>
            </div>

            {/* Grid */}
            <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <Card
                  key={project.projectId}
                  onClick={() => onOpenProject(project.projectId)}
                  className="border-border/70 bg-card/60 hover:border-primary/50 group flex cursor-pointer flex-col justify-between p-5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div>
                    {/* Project name */}
                    <h3 className="truncate text-lg font-semibold text-foreground">
                      {project.projectName}
                    </h3>

                    {/* Description */}
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {project.projectDescription || 'No description'}
                    </p>

                    {/* Stats row */}
                    <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Layers className="size-3.5" />
                        {project.nodes.length} resource
                        {project.nodes.length !== 1 ? 's' : ''}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        {formatRelativeTime(
                          project.lastSavedAt || new Date().toISOString(),
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Bottom row — Open + Delete */}
                  <div className="mt-4 flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                      <FolderOpen className="size-4" />
                      Open
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
                      className="hover:bg-destructive/10 size-8 text-muted-foreground hover:text-destructive"
                      aria-label={`Delete ${project.projectName}`}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        ) : (
          /* ── Empty State ── */
          <EmptyState
            title="No projects yet"
            description="Create your first cloud architecture. Drag services, connect, validate, and deploy directly to AWS in minutes."
            icon={FolderOpen}
            actionText="Create Project"
            onAction={onNewProject}
            className="py-16"
          />
        )}
      </div>

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
