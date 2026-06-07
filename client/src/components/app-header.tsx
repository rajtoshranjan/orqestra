import { useState, useEffect } from 'react';
import {
  Building2,
  Plus,
  ChevronDown,
  LogOut,
  FolderGit2,
  Settings as LucideSettings,
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
  DialogHeader,
  DialogFooter,
  DialogTitle,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { cn } from '@/lib/utils';
import {
  useGetUserInfo,
  useOrganisations,
  useCreateOrganisation,
} from '@/api/auth';
import { localStorageManager } from '@/lib/utils/local-storage-manager';
import { logout } from '@/api/client';

export function AppHeader() {
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
    if (isAuthenticated && orgs && orgs.length > 0) {
      const isValidOrg = orgs.some((o) => o.id === activeOrgId);
      if (!activeOrgId || !isValidOrg) {
        localStorageManager.setActiveOrgId(orgs[0].id);
        window.location.reload();
      }
    }
  }, [orgs, activeOrgId, isAuthenticated]);

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
        },
      );
    }
  };

  if (!isAuthenticated) return null;

  // Get initials for user avatar
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getPageIconAndLabel = () => {
    const path = window.location.pathname;
    if (path.includes('/settings')) {
      return {
        label: 'Settings',
        icon: LucideSettings,
      };
    }
    return {
      label: 'Projects',
      icon: FolderGit2,
    };
  };

  const page = getPageIconAndLabel();
  const PageIcon = page.icon;

  return (
    <header className="bg-[var(--color-bg-surface)]/70 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border px-6 shadow-[0_1px_4px_rgba(0,0,0,0.05)] backdrop-blur-md">
      {/* Left section: Breadcrumb/Page context */}
      <div className="flex items-center gap-2">
        <span className="hidden select-none items-center gap-1 rounded border border-border/80 bg-accent/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground sm:inline-flex">
          Console
        </span>
        <span className="hidden select-none text-xs text-muted-foreground/30 sm:inline">
          /
        </span>
        <div className="animate-fade-in flex select-none items-center gap-2 rounded-md border border-border/80 bg-[var(--color-bg-surface)] px-2.5 py-1 text-xs font-bold text-foreground shadow-sm">
          <PageIcon className="size-3.5 shrink-0 text-primary" />
          <span>{page.label}</span>
        </div>
      </div>

      {/* Right section: Org Switcher and Profile Dropdown */}
      <div className="flex items-center gap-4">
        {/* Organisation Switcher */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex h-8 items-center gap-2 rounded-md border border-border bg-[var(--color-bg-surface)] px-3 text-xs font-semibold text-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <Building2 className="size-3.5 shrink-0 text-primary" />
              <span className="max-w-[150px] truncate font-medium">
                {activeOrg ? activeOrg.name : 'Select Org'}
              </span>
              <ChevronDown className="size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-48 border-border bg-[var(--color-bg-surface)] text-foreground"
            align="end"
          >
            <DropdownMenuLabel className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Organisations
            </DropdownMenuLabel>
            {orgs?.map((o) => (
              <DropdownMenuItem
                key={o.id}
                onClick={() => handleSwitchOrg(o.id)}
                className={cn(
                  'cursor-pointer px-2.5 py-2 text-xs',
                  o.id === activeOrgId && 'bg-accent/30 font-bold text-primary',
                )}
              >
                {o.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={handleCreateOrgClick}
              className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs text-primary focus:bg-primary/5 focus:text-primary"
            >
              <Plus className="size-3.5" />
              New Org
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User Profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex h-8 items-center gap-2 rounded-full border border-border bg-[var(--color-bg-surface)] pl-1.5 pr-3 text-xs font-semibold text-muted-foreground shadow-sm transition-all hover:border-primary/30 hover:bg-accent/40 hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <span className="flex size-6 shrink-0 select-none items-center justify-center rounded-full border border-primary/20 bg-gradient-to-tr from-primary to-indigo-500 text-[10px] font-bold text-white shadow-sm">
                {getInitials(user?.name)}
              </span>
              <span className="hidden max-w-[100px] truncate text-left font-medium text-foreground sm:inline">
                {user ? user.name : 'Profile'}
              </span>
              <ChevronDown className="size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-48 border-border bg-[var(--color-bg-surface)] text-foreground"
            align="end"
          >
            {user && (
              <>
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-bold text-foreground">
                    {user.name}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator className="bg-border" />
              </>
            )}
            <DropdownMenuItem
              onClick={logout}
              className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="size-3.5" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Organisation Creation Modal Dialog */}
      <Dialog open={createOrgDialogOpen} onOpenChange={setCreateOrgDialogOpen}>
        <DialogContent className="border-border bg-[var(--color-bg-surface)] text-foreground sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-foreground">
              Create Organisation
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateOrgSubmit} className="space-y-4">
            <div className="space-y-1">
              <label
                htmlFor="orgName"
                className="text-xs font-semibold text-muted-foreground"
              >
                Organisation Name
              </label>
              <Input
                id="orgName"
                value={newOrgName}
                onChange={(e) => setNewOrgName(e.target.value)}
                placeholder="My Awesome Org"
                className="h-8 border-input text-xs text-foreground focus-visible:ring-primary"
              />
            </div>
            <DialogFooter className="mt-4 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOrgDialogOpen(false)}
                className="h-8 border-border text-xs text-foreground hover:bg-accent/50"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="h-8 text-xs"
                disabled={!newOrgName.trim() || createOrgMutation.isPending}
              >
                {createOrgMutation.isPending ? 'Creating...' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </header>
  );
}
