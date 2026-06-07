import type { ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Hexagon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
  Building2,
  Plus,
  ChevronDown,
  User as UserIcon,
  LogOut,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import {
  useGetUserInfo,
  useOrganisations,
  useCreateOrganisation,
} from '@/api/auth';
import { localStorageManager } from '@/lib/utils/local-storage-manager';
import { logout } from '@/api/client';
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
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';

export type AppShellView = 'projects' | 'settings';

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
    view: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
  },
] satisfies Array<{
  view: AppShellView;
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
}>;

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useLocalStorage(
    'sidebarCollapsed',
    false,
  );

  const isAuthenticated = localStorageManager.hasToken();

  const { data: user } = useGetUserInfo(isAuthenticated);
  const { data: orgs } = useOrganisations(isAuthenticated);
  const createOrgMutation = useCreateOrganisation();

  const activeOrgId = localStorageManager.getActiveOrgId();
  const activeOrg = orgs?.find((o) => o.id === activeOrgId) || orgs?.[0];

  // Organisation Creation Dialog States.
  const [createOrgDialogOpen, setCreateOrgDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');

  // Set default active org if not set or if current active org is invalid.
  useEffect(() => {
    if (orgs && orgs.length > 0) {
      const isValidOrg = orgs.some((o) => o.id === activeOrgId);
      if (!activeOrgId || !isValidOrg) {
        localStorageManager.setActiveOrgId(orgs[0].id);
        window.location.reload();
      }
    }
  }, [orgs, activeOrgId]);

  const handleSwitchOrg = (orgId: string) => {
    localStorageManager.setActiveOrgId(orgId);
    window.location.reload();
  };

  const handleCreateOrgClick = () => {
    setNewOrgName('');
    setCreateOrgDialogOpen(true);
  };

  const handleCreateOrgSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrgName.trim()) {
      createOrgMutation.mutate(
        { name: newOrgName.trim() },
        {
          onSuccess: (newOrg) => {
            localStorageManager.setActiveOrgId(newOrg.id);
            setCreateOrgDialogOpen(false);
            window.location.reload();
          },
        }
      );
    }
  };

  return (
    <aside
      className={cn(
        'flex min-h-screen w-14 shrink-0 flex-col border-r border-border bg-[var(--color-bg-surface)] text-card-foreground transition-all duration-300',
        isCollapsed ? 'md:w-14' : 'md:w-44',
      )}
    >
      <div
        className={cn(
          'flex h-11 shrink-0 items-center border-b border-border',
          isCollapsed ? 'justify-center px-1' : 'md:justify-start md:px-2 px-1 justify-center',
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

      {/* Organisation Switcher */}
      {isAuthenticated && (
        <div className="border-b border-border p-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-8 items-center rounded-md text-[11px] font-semibold text-foreground hover:bg-accent/50 transition-colors',
                  'mx-auto w-8 justify-center',
                  !isCollapsed && 'md:mx-0 md:w-full md:justify-between md:px-2 md:gap-2'
                )}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <Building2 className="size-3.5 shrink-0 text-primary" />
                  {!isCollapsed && (
                    <span className="hidden md:inline truncate text-left">
                      {activeOrg ? activeOrg.name : 'Select Org'}
                    </span>
                  )}
                </span>
                {!isCollapsed && (
                  <ChevronDown className="hidden md:inline size-3 shrink-0 text-muted-foreground" />
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44 bg-[var(--color-bg-surface)] border-border" align="start">
              <DropdownMenuLabel className="text-[9px] text-muted-foreground font-semibold px-2 py-1">
                Organisations
              </DropdownMenuLabel>
              {orgs?.map((o) => (
                <DropdownMenuItem
                  key={o.id}
                  onClick={() => handleSwitchOrg(o.id)}
                  className={cn(
                    'text-xs cursor-pointer',
                    o.id === activeOrgId && 'font-bold bg-accent/30'
                  )}
                >
                  {o.name}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem onClick={handleCreateOrgClick} className="text-xs cursor-pointer flex items-center gap-1.5">
                <Plus className="size-3" />
                New Org
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

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
                !isCollapsed && 'md:mx-0 md:w-full md:justify-start md:gap-2 md:px-2',
                active
                  ? 'bg-primary/10 font-semibold text-primary'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              {active && (
                <span
                  className={cn(
                    'absolute top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-primary',
                    isCollapsed ? '-left-[13px]' : 'md:left-0 -left-[13px]',
                  )}
                />
              )}
              <Icon className="size-3.5 shrink-0" />
              {!isCollapsed && (
                <span className="hidden md:inline truncate">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* User Profile dropdown */}
      {isAuthenticated && (
        <div className="border-t border-border p-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex h-8 items-center rounded-md text-[11px] font-semibold text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors',
                  'mx-auto w-8 justify-center',
                  !isCollapsed && 'md:mx-0 md:w-full md:justify-start md:gap-2 md:px-2'
                )}
              >
                <UserIcon className="size-3.5 shrink-0" />
                {!isCollapsed && (
                  <span className="hidden md:inline truncate text-left">
                    {user ? user.name : 'Profile'}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-44 bg-[var(--color-bg-surface)] border-border" align="start">
              {user && (
                <>
                  <div className="px-2 py-1.5">
                    <p className="text-[10px] font-bold text-foreground truncate">{user.name}</p>
                    <p className="text-[9px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                  <DropdownMenuSeparator className="bg-border" />
                </>
              )}
              <DropdownMenuItem onClick={logout} className="text-xs cursor-pointer flex items-center gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="size-3" />
                Log Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      <div className="hidden border-t border-border p-1.5 md:block">
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex h-8 items-center rounded-md text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground',
            'mx-auto w-8 justify-center',
            !isCollapsed && 'md:mx-0 md:w-full md:justify-start md:gap-2 md:px-2',
          )}
        >
          {isCollapsed ? (
            <PanelLeftOpen className="size-3.5" />
          ) : (
            <>
              <PanelLeftClose className="size-3.5 shrink-0" />
              <span className="hidden md:inline truncate">Collapse</span>
            </>
          )}
        </button>
      </div>

      {/* Organisation Creation Modal Dialog */}
      <Dialog open={createOrgDialogOpen} onOpenChange={setCreateOrgDialogOpen}>
        <DialogContent className="sm:max-w-md bg-[var(--color-bg-surface)] border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">Create Organisation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrgSubmit} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="orgName" className="text-xs font-semibold text-muted-foreground">
                Organisation Name
              </label>
              <Input
                id="orgName"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="My Awesome Org"
                className="border-input text-foreground focus-visible:ring-primary h-8 text-xs"
                autoFocus
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0 mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOrgDialogOpen(false)}
                className="text-xs h-8 border-border hover:bg-accent/50 text-foreground"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="text-xs h-8"
                disabled={!newOrgName.trim() || createOrgMutation.isPending}
              >
                {createOrgMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
