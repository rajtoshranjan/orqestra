import { useState } from 'react';

import {
  Plus,
  LayoutDashboard,
  Trash2,
  Layers,
  Clock,
  Search,
  ChevronDown,
  SearchX,
} from 'lucide-react';

import { useProjects, useDeleteProject, useAWSAccounts } from '@/api';
import { PageLayout } from '@/components';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { formatRelativeTime } from '@/utils';

type ProjectsProps = {
  onOpenProject: (projectId: string) => void;
  onNewProject: (params: {
    projectName: string;
    projectDescription: string;
    awsAccountId: string | null;
  }) => void;
};

export function Projects({ onOpenProject, onNewProject }: ProjectsProps) {
  const { data: projects = [], isLoading } = useProjects();
  const { data: awsAccounts = [] } = useAWSAccounts();
  const deleteProjectMutation = useDeleteProject();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({
    projectName: '',
    projectDescription: '',
    awsAccountId: '',
  });

  /* Search & Filter States */
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'saved' | 'resources' | 'name'>('saved');

  const deleteProject = (projectId: string) => {
    deleteProjectMutation.mutate(projectId);
  };

  const handleCreateProject = () => {
    if (!newProjectForm.projectName.trim() || !newProjectForm.awsAccountId) {
      return;
    }
    onNewProject({
      projectName: newProjectForm.projectName,
      projectDescription: newProjectForm.projectDescription,
      awsAccountId: newProjectForm.awsAccountId,
    });
    setNewProjectOpen(false);
    setNewProjectForm({
      projectName: '',
      projectDescription: '',
      awsAccountId: '',
    });
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
      title="Your Projects"
      description="Design, validate, and deploy secure cloud architectures directly on a visual, interactive canvas."
    >
      {/* Main Grid View */}
      <div className="relative z-10 mt-6 flex w-full flex-1 flex-col">
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
                  <Input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-8 w-44 border-[var(--color-border)] bg-[var(--color-bg-surface)] pl-8 pr-2.5 text-xs sm:w-56"
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
                  onClick={() => setNewProjectOpen(true)}
                  className="flex h-8 items-center gap-1 rounded-md border border-primary/35 bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md hover:shadow-primary/20"
                >
                  <Plus className="size-3.5" />
                  New Project
                </Button>
              </div>
            </div>
            {/* No projects for applied filters */}
            {filteredProjects.length === 0 && (
              <EmptyState
                title="No projects found"
                description="Try changing your filters or search terms."
                icon={SearchX}
              />
            )}
            <div className="stagger-children grid grid-cols-[repeat(auto-fill,minmax(340px,1fr))] gap-5">
              {filteredProjects.map((project) => {
                return (
                  <Card
                    key={project.projectId}
                    onClick={() => onOpenProject(project.projectId)}
                    className="group relative flex cursor-pointer flex-col justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-surface)] p-5 text-left transition-all duration-300 ease-out hover:-translate-y-1 hover:border-primary/40 hover:shadow-md hover:shadow-primary/5"
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
                        Open Canvas
                      </span>

                      <Button
                        variant="ghost"
                        size="icon"
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
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
          <div className="animate-fade-in mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center pb-20">
            <EmptyState
              title="No projects found"
              description="You haven't created any architectures yet. Click below to start designing on the canvas."
              icon={LayoutDashboard}
              actionText="Create Project"
              onAction={() => setNewProjectOpen(true)}
              className="py-12"
            />
          </div>
        )}
      </div>

      {/* New Project Dialog */}
      <Dialog open={newProjectOpen} onOpenChange={setNewProjectOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Set up a new architecture project. You can configure additional
              settings later in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="projectName" className="text-sm font-medium">
                Project Name
              </label>
              <Input
                id="projectName"
                placeholder="e.g., My Web App Infrastructure"
                value={newProjectForm.projectName}
                onChange={(event) =>
                  setNewProjectForm({
                    ...newProjectForm,
                    projectName: event.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <label
                htmlFor="projectDescription"
                className="text-sm font-medium"
              >
                Description (Optional)
              </label>
              <Textarea
                id="projectDescription"
                placeholder="Describe your architecture..."
                value={newProjectForm.projectDescription}
                onChange={(event) =>
                  setNewProjectForm({
                    ...newProjectForm,
                    projectDescription: event.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="awsAccount" className="text-sm font-medium">
                AWS Account
              </label>
              {awsAccounts.length === 0 ? (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  No AWS accounts found. Please configure one in{' '}
                  <a
                    href="/org-settings"
                    className="underline hover:no-underline"
                  >
                    organisation settings
                  </a>
                  .
                </div>
              ) : (
                <Select
                  id="awsAccount"
                  value={newProjectForm.awsAccountId}
                  onChange={(event) =>
                    setNewProjectForm({
                      ...newProjectForm,
                      awsAccountId: event.target.value,
                    })
                  }
                >
                  <option value="">Select an AWS account...</option>
                  {awsAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewProjectOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateProject}
              disabled={
                !newProjectForm.projectName.trim() ||
                !newProjectForm.awsAccountId ||
                awsAccounts.length === 0
              }
            >
              Create Project
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
