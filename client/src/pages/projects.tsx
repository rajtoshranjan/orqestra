import { useState } from 'react';
import {
  Plus,
  LayoutDashboard,
  Trash2,
  Layers,
  Clock,
  Search,
  ChevronDown,
} from 'lucide-react';

import { formatRelativeTime } from '@/utils';
import { useProjects, useDeleteProject } from '@/api';
import { registry } from '@/services';
import {
  Button,
  Card,
  EmptyState,
  LoadingState,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui';
import { PageLayout } from '@/components';

type ProjectsProps = {
  onOpenProject: (projectId: string) => void;
  onNewProject: () => void;
};

export function Projects({ onOpenProject, onNewProject }: ProjectsProps) {
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
    <PageLayout
      title={
        <>
          Your Projects
          {projects.length > 0 && (
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded border border-border bg-accent px-2 font-mono text-[10px] font-bold text-accent-foreground">
              {projects.length}
            </span>
          )}
        </>
      }
      description="Design, validate, and deploy secure cloud architectures directly on a visual, interactive canvas."
    >
      {/* Main Grid View */}
      <div className="relative z-10 mt-6 w-full flex-1">
        {isLoading ? (
          /* Loading Skeletons */
          <LoadingState variant="skeleton-grid" count={3} />
        ) : projects.length > 0 ? (
          <div className="space-y-6">
            {/* Search, Sorting, and Add Project Actions Row */}
            <div className="animate-fade-in flex select-none flex-wrap items-center justify-between gap-4">
              {/* Left Metadata Indicator. */}
              <div className="flex items-center gap-2">
                {/* Search Field. */}
                <div className="group relative">
                  <span className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-muted-foreground/60 transition-colors duration-200 group-focus-within:text-primary">
                    <Search className="size-3.5" />
                  </span>
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 w-44 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-8 pr-2.5 text-xs text-[var(--color-text-primary)] placeholder-muted-foreground transition-all duration-200 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:w-56"
                  />
                </div>

                {/* Sort Selector. */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 border-[var(--color-border)] bg-[var(--color-bg-surface)] px-3 text-xs font-normal hover:bg-[var(--color-bg-elevated)]"
                    >
                      <span>Sort: </span>
                      <span className="font-medium text-foreground">
                        {sortBy === 'saved'
                          ? 'Last Saved'
                          : sortBy === 'resources'
                            ? 'Most Resources'
                            : 'Alphabetical'}
                      </span>
                      <ChevronDown className="size-3.5 text-muted-foreground opacity-60" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-[160px] border-[var(--color-border)] bg-[var(--color-bg-surface)]"
                  >
                    <DropdownMenuRadioGroup
                      value={sortBy}
                      onValueChange={(val) => {
                        if (
                          val === 'saved' ||
                          val === 'resources' ||
                          val === 'name'
                        ) {
                          setSortBy(val);
                        }
                      }}
                    >
                      <DropdownMenuRadioItem
                        value="saved"
                        className="cursor-pointer text-xs text-foreground"
                      >
                        Last Saved
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="resources"
                        className="cursor-pointer text-xs text-foreground"
                      >
                        Most Resources
                      </DropdownMenuRadioItem>
                      <DropdownMenuRadioItem
                        value="name"
                        className="cursor-pointer text-xs text-foreground"
                      >
                        Alphabetical
                      </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Create Project Button. */}
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

            {/* Spacious 3-Column Projects Card Grid. */}
            <div className="stagger-children grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map((project) => {
                /* Extract unique AWS services used in this project nodes list. */
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
                    className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 text-left transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-sm"
                  >
                    <div className="space-y-4">
                      {/* Card Header: Title & Project Status. */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          <h3 className="truncate text-sm font-semibold tracking-tight text-foreground transition-colors duration-300 group-hover:text-primary">
                            {project.projectName}
                          </h3>
                          <p className="mt-2 line-clamp-2 min-h-[32px] text-xs leading-relaxed text-[var(--color-text-secondary)]">
                            {project.projectDescription ||
                              'No description provided.'}
                          </p>
                        </div>

                        {/* Service Icons Array on the top-right, clean and minimal. */}
                        {projectServices.length > 0 && (
                          <div className="bg-[var(--color-bg-base)]/60 flex shrink-0 items-center gap-1 rounded-md border border-[var(--color-border)] p-1 transition-all duration-300 group-hover:border-[var(--color-border-hover)] group-hover:bg-[var(--color-bg-base)]">
                            {projectServices.map((service) => {
                              const ServiceIcon = service.icon;
                              return (
                                <div
                                  key={service.id}
                                  className="flex size-6 shrink-0 items-center justify-center rounded border border-[var(--color-border)] bg-[var(--color-bg-surface)] text-[var(--color-text-secondary)] transition-all duration-300 group-hover:border-[var(--color-border-hover)] group-hover:text-[var(--color-text-primary)]"
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

                      {/* Stats row. */}
                      <div className="flex flex-wrap items-center gap-2 text-[10px]">
                        <span className="inline-flex select-none items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                          <Layers className="size-2.5 text-[var(--color-text-muted)]" />
                          {project.nodes.length} resource
                          {project.nodes.length !== 1 ? 's' : ''}
                        </span>
                        <span className="inline-flex select-none items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-text-secondary)]">
                          <Clock className="size-2.5 text-[var(--color-text-muted)]" />
                          {formatRelativeTime(
                            project.lastSavedAt || new Date().toISOString(),
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Actions Row. */}
                    <div className="mt-5 flex select-none items-center justify-between border-t border-border/10 pt-3">
                      <span className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-bg-elevated)] px-3 text-[11px] font-medium text-[var(--color-text-secondary)] transition-colors group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary">
                        <LayoutDashboard className="size-3.5 text-[var(--color-text-muted)] transition-colors group-hover:text-primary" />
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
              icon={LayoutDashboard}
              actionText="Create Project"
              onAction={onNewProject}
              className="rounded-xl border border-dashed border-border bg-card/10 py-16"
            />
          </div>
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
    </PageLayout>
  );
}
