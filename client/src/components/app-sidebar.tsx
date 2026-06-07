import { useEffect, useState, type ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';
import {
  Building2,
  ChevronDown,
  Hexagon,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  PencilLine,
  Plus,
} from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  useCreateOrganisation,
  useOrganisations,
  useUpdateOrganisation,
} from '@/api/auth';
import { cn } from '@/lib/utils';
import { localStorageManager } from '@/lib/utils/local-storage-manager';

export type AppShellView = 'projects';

type AppSidebarProps = {
  onNavigate: (path: string) => void;
};

const navItems = [
  {
    view: 'projects',
    label: 'Projects',
    path: '/',
    icon: LayoutDashboard,
  },
] satisfies Array<{
  view: AppShellView;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}>;

const getOrganisationInitials = (name?: string): string => {
  if (!name) {
    return 'O';
  }

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useLocalStorage(
    'sidebarCollapsed',
    false,
  );
  const isAuthenticated = localStorageManager.hasToken();
  const { data: organisations } = useOrganisations(isAuthenticated);
  const createOrganisationMutation = useCreateOrganisation();
  const updateOrganisationMutation = useUpdateOrganisation();
  const activeOrganisationId = localStorageManager.getActiveOrgId();
  const activeOrganisation =
    organisations?.find(
      (organisation) => organisation.id === activeOrganisationId,
    ) || organisations?.[0];
  const [createOrganisationDialogOpen, setCreateOrganisationDialogOpen] =
    useState<boolean>(false);
  const [editOrganisationDialogOpen, setEditOrganisationDialogOpen] =
    useState<boolean>(false);
  const [newOrganisationName, setNewOrganisationName] = useState<string>('');
  const [editedOrganisationName, setEditedOrganisationName] =
    useState<string>('');

  useEffect(() => {
    if (!isAuthenticated || !organisations?.length) {
      return;
    }

    const hasValidActiveOrganisation = organisations.some(
      (organisation) => organisation.id === activeOrganisationId,
    );

    if (!activeOrganisationId || !hasValidActiveOrganisation) {
      localStorageManager.setActiveOrgId(organisations[0].id);
      window.location.reload();
    }
  }, [activeOrganisationId, isAuthenticated, organisations]);

  const handleSwitchOrganisation = (organisationId: string): void => {
    localStorageManager.setActiveOrgId(organisationId);
    window.location.reload();
  };

  const canEditActiveOrganisation =
    activeOrganisation?.role === 'owner' ||
    activeOrganisation?.role === 'admin';

  const handleCreateOrganisationClick = (): void => {
    setNewOrganisationName('');
    setCreateOrganisationDialogOpen(true);
  };

  const handleEditOrganisationClick = (): void => {
    if (!canEditActiveOrganisation) {
      return;
    }

    setEditedOrganisationName(activeOrganisation?.name ?? '');
    setEditOrganisationDialogOpen(true);
  };

  const handleCreateOrganisationSubmit = (event: React.FormEvent): void => {
    event.preventDefault();

    if (!newOrganisationName.trim()) {
      return;
    }

    createOrganisationMutation.mutate(
      { name: newOrganisationName.trim() },
      {
        onSuccess: (organisation) => {
          localStorageManager.setActiveOrgId(organisation.id);
          setCreateOrganisationDialogOpen(false);
          window.location.reload();
        },
      },
    );
  };

  const handleEditOrganisationSubmit = (event: React.FormEvent): void => {
    event.preventDefault();

    if (
      !activeOrganisation ||
      !canEditActiveOrganisation ||
      !editedOrganisationName.trim()
    ) {
      return;
    }

    updateOrganisationMutation.mutate(
      {
        organisationId: activeOrganisation.id,
        name: editedOrganisationName.trim(),
      },
      {
        onSuccess: () => {
          setEditOrganisationDialogOpen(false);
        },
      },
    );
  };

  return (
    <>
      <aside
        className={cn(
          'flex min-h-screen w-14 shrink-0 flex-col border-r border-border bg-[var(--color-bg-surface)] text-card-foreground transition-all duration-300',
          isCollapsed ? 'md:w-14' : 'md:w-52',
        )}
      >
        <div
          className={cn(
            'flex h-11 shrink-0 items-center border-b border-border',
            isCollapsed
              ? 'justify-center px-1'
              : 'justify-center px-1 md:justify-start md:px-2',
          )}
        >
          <button
            type="button"
            onClick={() => onNavigate('/')}
            aria-label="Go to projects"
            className="flex min-w-0 items-center gap-2"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Hexagon className="size-3.5" />
            </span>
            <span
              className={cn(
                'hidden truncate text-sm font-bold tracking-tight md:block',
                isCollapsed && 'md:hidden',
              )}
            >
              Orqestra
            </span>
          </button>
        </div>

        {isAuthenticated && organisations?.length ? (
          <div className="border-b border-border px-1.5 py-2">
            <div className="flex min-w-0 items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'flex h-9 min-w-0 items-center rounded-md border border-border bg-background/60 text-left text-[12px] font-medium text-foreground transition-colors hover:bg-accent/50',
                      isCollapsed
                        ? 'w-full justify-center px-0'
                        : 'flex-1 justify-center px-0 md:justify-between md:px-2.5',
                    )}
                    aria-label={
                      activeOrganisation
                        ? `Selected organisation ${activeOrganisation.name}`
                        : 'Select organisation'
                    }
                  >
                    {isCollapsed ? (
                      <span className="flex size-6 items-center justify-center rounded-md bg-primary/10 text-[10px] font-bold text-primary">
                        {getOrganisationInitials(activeOrganisation?.name)}
                      </span>
                    ) : (
                      <>
                        <span className="hidden min-w-0 flex-1 items-center gap-2 md:flex">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            <Building2 className="size-3.5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-[12px] font-semibold text-foreground">
                              {activeOrganisation?.name ?? 'Select Org'}
                            </span>
                          </span>
                        </span>
                        <ChevronDown className="hidden size-3 shrink-0 text-muted-foreground md:block" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  className="w-56 border-border bg-[var(--color-bg-surface)] text-foreground"
                  align="start"
                  side="right"
                >
                  <DropdownMenuLabel className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Organisations
                  </DropdownMenuLabel>
                  {organisations.map((organisation) => (
                    <DropdownMenuItem
                      key={organisation.id}
                      onClick={() => handleSwitchOrganisation(organisation.id)}
                      className={cn(
                        'cursor-pointer px-2.5 py-2 text-xs',
                        organisation.id === activeOrganisationId &&
                          'bg-accent/30 font-bold text-primary',
                      )}
                    >
                      {organisation.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator className="bg-border" />
                  <DropdownMenuItem
                    onClick={handleCreateOrganisationClick}
                    className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs text-primary focus:bg-primary/5 focus:text-primary"
                  >
                    <Plus className="size-3.5" />
                    New Org
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {canEditActiveOrganisation && !isCollapsed ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleEditOrganisationClick}
                  aria-label="Edit organisation"
                  className="hidden size-9 shrink-0 rounded-md border border-border bg-background/60 text-muted-foreground hover:bg-accent/50 hover:text-foreground md:inline-flex"
                >
                  <PencilLine className="size-3.5" />
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        <nav className="flex-1 space-y-1 px-1.5 py-2" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;

            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-8 items-center rounded-md text-[12px] font-medium transition-colors',
                  'mx-auto w-8 justify-center',
                  !isCollapsed &&
                    'md:mx-0 md:w-full md:justify-start md:gap-2 md:px-2',
                  active
                    ? 'bg-primary/10 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
                )}
              >
                {active && (
                  <span
                    className={cn(
                      'absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary',
                      isCollapsed ? '-left-[13px]' : '-left-[13px] md:left-0',
                    )}
                  />
                )}
                <Icon className="size-3.5 shrink-0" />
                {!isCollapsed && (
                  <span className="hidden truncate md:inline">
                    {item.label}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="hidden border-t border-border p-1.5 md:block">
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-8 items-center rounded-md text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground',
              'mx-auto w-8 justify-center',
              !isCollapsed &&
                'md:mx-0 md:w-full md:justify-start md:gap-2 md:px-2',
            )}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="size-3.5" />
            ) : (
              <>
                <PanelLeftClose className="size-3.5 shrink-0" />
                <span className="hidden truncate md:inline">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>

      <Dialog
        open={editOrganisationDialogOpen}
        onOpenChange={setEditOrganisationDialogOpen}
      >
        <DialogContent className="border-border bg-[var(--color-bg-surface)] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Edit Organisation
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditOrganisationSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="edit-organisation-name"
                className="text-xs font-semibold text-muted-foreground"
              >
                Organisation Name
              </label>
              <Input
                id="edit-organisation-name"
                value={editedOrganisationName}
                onChange={(event) =>
                  setEditedOrganisationName(event.target.value)
                }
                placeholder="My Awesome Org"
                className="h-8 border-input text-xs text-foreground focus-visible:ring-primary"
              />
            </div>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOrganisationDialogOpen(false)}
                className="h-8 border-border text-xs text-foreground hover:bg-accent/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8 text-xs"
                disabled={
                  !editedOrganisationName.trim() ||
                  updateOrganisationMutation.isPending ||
                  editedOrganisationName.trim() === activeOrganisation?.name
                }
              >
                {updateOrganisationMutation.isPending ? 'Saving...' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={createOrganisationDialogOpen}
        onOpenChange={setCreateOrganisationDialogOpen}
      >
        <DialogContent className="border-border bg-[var(--color-bg-surface)] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Create Organisation
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrganisationSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="organisation-name"
                className="text-xs font-semibold text-muted-foreground"
              >
                Organisation Name
              </label>
              <Input
                id="organisation-name"
                value={newOrganisationName}
                onChange={(event) => setNewOrganisationName(event.target.value)}
                placeholder="My Awesome Org"
                className="h-8 border-input text-xs text-foreground focus-visible:ring-primary"
              />
            </div>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOrganisationDialogOpen(false)}
                className="h-8 border-border text-xs text-foreground hover:bg-accent/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8 text-xs"
                disabled={
                  !newOrganisationName.trim() ||
                  createOrganisationMutation.isPending
                }
              >
                {createOrganisationMutation.isPending
                  ? 'Creating...'
                  : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
