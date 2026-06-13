import { useEffect, useState, type ComponentType } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Settings,
  Users,
} from 'lucide-react';

import { OrqestraMark } from './icons';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';

import { useCreateOrganisation, useOrganisations } from '@/api/auth';
import { cn } from '@/lib/utils';
import { localStorageManager } from '@/lib/utils/local-storage-manager';

import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Input } from './ui/input';

export type AppShellView = 'projects' | 'settings' | 'members';

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
  {
    view: 'members',
    label: 'Members',
    path: '/org-members',
    icon: Users,
  },
  {
    view: 'settings',
    label: 'Settings',
    path: '/org-settings',
    icon: Settings,
  },
] satisfies Array<{
  view: AppShellView;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}>;

const GUEST_HIDDEN_NAV_VIEWS: AppShellView[] = ['members', 'settings'];

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
  const queryClient = useQueryClient();
  const isAuthenticated = localStorageManager.hasToken();
  const { data: organisations } = useOrganisations(isAuthenticated);
  const createOrganisationMutation = useCreateOrganisation();
  const [activeOrgId, setActiveOrgId] = useLocalStorage<string | null>(
    'activeOrgId',
    null,
  );
  const activeOrganisationId = activeOrgId;
  const activeOrganisation =
    organisations?.find(
      (organisation) => organisation.id === activeOrganisationId,
    ) || organisations?.[0];
  const isGuest = activeOrganisation?.role === 'guest';
  const visibleNavItems = navItems.filter(
    (item) => !(isGuest && GUEST_HIDDEN_NAV_VIEWS.includes(item.view)),
  );
  const [createOrganisationDialogOpen, setCreateOrganisationDialogOpen] =
    useState<boolean>(false);
  const [newOrganisationName, setNewOrganisationName] = useState<string>('');

  useEffect(() => {
    if (!isAuthenticated || !organisations?.length) {
      return;
    }

    const hasValidActiveOrganisation = organisations.some(
      (organisation) => organisation.id === activeOrganisationId,
    );

    if (!activeOrganisationId || !hasValidActiveOrganisation) {
      localStorageManager.setActiveOrgId(organisations[0].id);
      setActiveOrgId(organisations[0].id);
      void queryClient.invalidateQueries();
    }
  }, [
    activeOrganisationId,
    isAuthenticated,
    organisations,
    queryClient,
    setActiveOrgId,
  ]);

  const handleSwitchOrganisation = (organisationId: string): void => {
    localStorageManager.setActiveOrgId(organisationId);
    setActiveOrgId(organisationId);
    void queryClient.invalidateQueries();
  };

  const handleCreateOrganisationClick = (): void => {
    setNewOrganisationName('');
    setCreateOrganisationDialogOpen(true);
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
          setActiveOrgId(organisation.id);
          setCreateOrganisationDialogOpen(false);
          void queryClient.invalidateQueries();
        },
      },
    );
  };

  return (
    <>
      <aside
        className={cn(
          'flex h-full w-14 shrink-0 flex-col border-r border-border bg-[var(--color-bg-surface)] text-card-foreground transition-all duration-300',
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
            <OrqestraMark variant="color" size={20} className="shrink-0" />
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
          <div className="p-2">
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className={cn(
                      'group flex w-full min-w-0 items-center justify-center gap-2 rounded-lg border-none bg-transparent p-1 text-left shadow-none transition-all duration-200',
                      !isCollapsed &&
                        'md:justify-start md:border-none md:bg-[var(--color-bg-elevated)] md:p-2 md:shadow-none md:hover:bg-[var(--color-bg-hover)]',
                    )}
                    aria-label={
                      activeOrganisation
                        ? `Switch organisation: ${activeOrganisation.name}`
                        : 'Select organisation'
                    }
                    title={
                      activeOrganisation
                        ? `Switch organisation — ${activeOrganisation.name}`
                        : 'Select organisation'
                    }
                  >
                    <span
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-[10px] font-extrabold text-white transition-transform duration-200',
                        isCollapsed
                          ? 'group-hover:scale-105'
                          : 'group-hover:scale-105 md:group-hover:scale-100',
                      )}
                    >
                      {getOrganisationInitials(activeOrganisation?.name)}
                    </span>
                    {!isCollapsed && (
                      <>
                        <span className="hidden min-w-0 flex-1 text-left md:block">
                          <span className="block truncate text-xs font-semibold leading-tight tracking-tight text-foreground">
                            {activeOrganisation?.name ?? 'Organisation'}
                          </span>
                          <span className="mt-0.5 inline-flex items-center rounded-full bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[var(--color-accent)]">
                            {activeOrganisation?.role ?? 'Member'}
                          </span>
                        </span>
                        <ChevronDown className="hidden size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180 md:block" />
                      </>
                    )}
                  </button>
                </DropdownMenuTrigger>

                <DropdownMenuContent
                  className="w-60 rounded-lg border-border bg-[var(--color-bg-surface)] p-1.5 text-foreground shadow-xl"
                  align="start"
                  side="right"
                  sideOffset={12}
                >
                  <DropdownMenuLabel className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground/85">
                    Switch Organisation
                  </DropdownMenuLabel>
                  {organisations.map((organisation) => {
                    const isActive = organisation.id === activeOrganisationId;
                    return (
                      <DropdownMenuItem
                        key={organisation.id}
                        onClick={() =>
                          handleSwitchOrganisation(organisation.id)
                        }
                        className={cn(
                          'flex cursor-pointer items-center justify-between gap-3 rounded-md px-2.5 py-2 text-xs transition-colors duration-150',
                          isActive
                            ? 'bg-primary/10 font-medium text-primary hover:bg-primary/15'
                            : 'text-foreground hover:bg-accent/50',
                        )}
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className={cn(
                              'flex h-6 w-6 shrink-0 items-center justify-center rounded border border-white/5 text-[9px] font-bold text-white',
                              isActive
                                ? 'bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.2)]'
                                : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {getOrganisationInitials(organisation.name)}
                          </span>
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {organisation.name}
                            </span>
                            <span className="mt-0.5 block text-[9px] uppercase tracking-wide text-muted-foreground">
                              {organisation.role}
                            </span>
                          </div>
                        </div>
                        {isActive && (
                          <Check className="size-3.5 shrink-0 text-primary" />
                        )}
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator className="my-1.5 bg-border/60" />
                  <DropdownMenuItem
                    onClick={handleCreateOrganisationClick}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-xs text-primary hover:bg-primary/5 focus:bg-primary/5 focus:text-primary"
                  >
                    <Plus className="size-3.5" />
                    New Organisation
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ) : null}

        <nav className="flex-1 space-y-0.5 px-2 py-3" aria-label="Primary">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const active = location.pathname === item.path;

            return (
              <button
                key={item.view}
                type="button"
                onClick={() => onNavigate(item.path)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group relative flex h-8 items-center rounded-md text-xs font-medium transition-colors',
                  'mx-auto w-8 justify-center',
                  !isCollapsed &&
                    'md:mx-0 md:w-full md:justify-start md:gap-2 md:px-2',
                  active
                    ? 'bg-accent/20 font-semibold text-primary'
                    : 'text-muted-foreground hover:bg-accent/20 hover:text-foreground',
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
