import {
  Plus,
  FolderOpen,
  Trash2,
  Layers,
  Clock,
} from 'lucide-react';
import { formatRelativeTime } from '@/utils';
import { useProjects, useDeleteProject } from '@/lib/api';

interface DashboardProps {
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
}

export function Dashboard({ onOpenProject, onNewProject }: DashboardProps) {
  const { data: projects = [], isLoading } = useProjects();
  const deleteProjectMutation = useDeleteProject();

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
    <div
      className="min-h-screen"
      style={{ background: 'var(--color-bg-base)' }}
    >
      {/* ── Top Navigation ────────────────────────────────────────────── */}
      <nav
        className="flex h-11 items-center justify-between border-b px-3"
        style={{
          background: 'var(--color-bg-surface)',
          borderColor: 'var(--color-border)',
        }}
      >
        {/* Left — logo + app name */}
        <div className="flex items-center">
          <span
            className="text-[14px] font-bold tracking-tight cursor-default select-none"
            style={{
              color: 'var(--color-text-primary)',
              fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Orqestra
          </span>
        </div>

        {/* Right — New Project + avatar */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onNewProject}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1 text-[12px] font-medium text-white transition-all hover:brightness-110"
            style={{
              background: 'var(--color-accent)',
            }}
          >
            <Plus className="h-3.5 w-3.5" />
            New Project
          </button>

          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold"
            style={{
              background: 'var(--color-accent-subtle)',
              color: 'var(--color-accent)',
            }}
          >
            DT
          </div>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────────────── */}
      <div className="animate-fade-in mx-auto max-w-6xl px-8 py-12">
        <h1
          className="text-3xl font-bold tracking-tight"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Your Workspaces
        </h1>
        <p
          className="mt-2 text-base"
          style={{ color: 'var(--color-text-muted)' }}
        >
          Design, validate, and deploy cloud architectures
        </p>

        {/* Stats row */}
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Total Projects */}
          <div className="glass rounded-xl px-5 py-4">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Total Projects
            </p>
            <p
              className="mt-2 text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {totalProjects}
            </p>
          </div>

          {/* Total Resources */}
          <div className="glass rounded-xl px-5 py-4">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Total Resources
            </p>
            <p
              className="mt-2 text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {totalResources}
            </p>
          </div>

          {/* Last Active */}
          <div className="glass rounded-xl px-5 py-4">
            <p
              className="text-xs font-semibold uppercase tracking-widest"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Last Active
            </p>
            <p
              className="mt-2 text-2xl font-bold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              {lastActive}
            </p>
          </div>
        </div>
      </div>

      {/* ── Projects Grid / Empty State ───────────────────────────────── */}
      <div className="mx-auto max-w-6xl px-8 pb-16">
        {isLoading ? (
          /* ── Premium Skeleton Grid ── */
          <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="glass flex h-44 animate-pulse flex-col justify-between rounded-xl p-5"
                style={{
                  background: 'var(--color-bg-elevated)',
                  borderColor: 'var(--color-border)',
                }}
              >
                <div>
                  <div className="h-5 w-2/3 rounded bg-white/10" />
                  <div className="mt-2 h-4 w-1/2 rounded bg-white/5" />
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="h-4 w-1/4 rounded bg-white/10" />
                  <div className="h-6 w-6 rounded bg-white/5" />
                </div>
              </div>
            ))}
          </div>
        ) : projects.length > 0 ? (
          <>
            {/* Section header */}
            <div className="mb-6 flex items-center gap-3">
              <h2
                className="text-lg font-semibold"
                style={{ color: 'var(--color-text-primary)' }}
              >
                Projects
              </h2>
              <span
                className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-full px-2 text-xs font-semibold"
                style={{
                  background: 'var(--color-accent-subtle)',
                  color: 'var(--color-accent)',
                }}
              >
                {projects.length}
              </span>
            </div>

            {/* Grid */}
            <div className="stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <button
                  type="button"
                  key={project.projectId}
                  onClick={() => onOpenProject(project.projectId)}
                  className="surface-elevated group cursor-pointer rounded-xl p-5 text-left transition-all hover:border-[var(--color-accent-subtle)]"
                  style={{
                    transition: 'var(--transition-base)',
                  }}
                >
                  {/* Project name */}
                  <h3
                    className="truncate text-lg font-semibold"
                    style={{ color: 'var(--color-text-primary)' }}
                  >
                    {project.projectName}
                  </h3>

                  {/* Description */}
                  <p
                    className="mt-1 truncate text-sm"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {project.projectDescription || 'No description'}
                  </p>

                  {/* Stats row */}
                  <div
                    className="mt-4 flex items-center gap-4 text-xs"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5" />
                      {project.nodes.length} resource
                      {project.nodes.length !== 1 ? 's' : ''}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatRelativeTime(
                        project.lastSavedAt || new Date().toISOString(),
                      )}
                    </span>
                  </div>

                  {/* Bottom row — Open + Delete */}
                  <div className="mt-4 flex items-center justify-between">
                    <span
                      className="inline-flex items-center gap-1.5 text-sm font-medium"
                      style={{ color: 'var(--color-accent)' }}
                    >
                      <FolderOpen className="h-4 w-4" />
                      Open
                    </span>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteProject(project.projectId);
                      }}
                      className="rounded-md p-1.5 transition-colors"
                      style={{
                        color: 'var(--color-text-muted)',
                        transition: 'var(--transition-fast)',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color =
                          'var(--color-error)';
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = 'var(--color-error-subtle)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.color =
                          'var(--color-text-muted)';
                        (
                          e.currentTarget as HTMLButtonElement
                        ).style.background = 'transparent';
                      }}
                      aria-label={`Delete ${project.projectName}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* ── Empty State ── */
          <div className="animate-fade-in flex flex-col items-center justify-center py-24">
            <div
              className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl"
              style={{ background: 'var(--color-bg-elevated)' }}
            >
              <FolderOpen
                className="h-16 w-16"
                style={{ color: 'var(--color-text-muted)' }}
              />
            </div>
            <h2
              className="text-xl font-semibold"
              style={{ color: 'var(--color-text-primary)' }}
            >
              No projects yet
            </h2>
            <p
              className="mt-2 text-sm"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Create your first cloud architecture
            </p>
            <button
              type="button"
              onClick={onNewProject}
              className="mt-6 inline-flex items-center gap-2 rounded-lg px-6 py-3 text-sm font-medium text-white transition-all hover:brightness-110"
              style={{
                background: 'var(--color-accent)',
                transition: 'var(--transition-fast)',
              }}
            >
              <Plus className="h-5 w-5" />
              Create Project
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
