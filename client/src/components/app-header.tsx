import { useState } from 'react';

import { ChevronDown, LogOut, Settings as SettingsIcon } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';

import { useGetUserInfo, useOrganisations, useLogout } from '@/api/auth';
import { logout as localLogout } from '@/api/client';
import { history } from '@/lib/utils';
import { localStorageManager } from '@/lib/utils/local-storage-manager';
import { getInitials } from '@/utils';

import { NotificationsBell } from './notifications-bell';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

const getCurrentSectionLabel = (): string => {
  const path = window.location.pathname;
  if (path === '/') {
    return 'Projects';
  }

  if (path === '/preferences') {
    return 'Preferences';
  }

  if (path === '/org-settings') {
    return 'Organisation settings';
  }

  if (path === '/org-members') {
    return 'Organisation members';
  }

  return path.replace('/', '');
};

const shouldShowOrganisationContext = (pathname: string): boolean => {
  return pathname !== '/preferences';
};

export function AppHeader() {
  const location = useLocation();

  // Stages.
  const [isAuthenticated] = useState(() => localStorageManager.hasToken());

  // Hooks.
  const logoutMutation = useLogout();
  const { data: user } = useGetUserInfo(isAuthenticated);
  const { data: organisations } = useOrganisations(isAuthenticated);
  const [activeOrgId] = useLocalStorage<string | null>('activeOrgId', null);

  // Computed states.
  const activeOrganisation =
    organisations?.find((organisation) => organisation.id === activeOrgId) ||
    organisations?.[0];
  const showOrganisationContext = shouldShowOrganisationContext(
    location.pathname,
  );

  // Handlers.
  const onLogoutClick = () => {
    const refreshToken = localStorageManager.getRefreshToken() || '';
    logoutMutation.mutate(refreshToken, {
      onSettled: () => {
        localLogout();
      },
    });
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="z-20 flex h-11 shrink-0 items-center justify-between border-b border-border bg-card/70 px-6 backdrop-blur-md">
      <div className="flex min-w-0 items-center gap-2">
        {showOrganisationContext && activeOrganisation?.name ? (
          <>
            <span className="truncate text-xs font-medium text-muted-foreground">
              {activeOrganisation.name}
            </span>
            <span className="text-xs text-muted-foreground/40">/</span>
          </>
        ) : null}
        <span className="truncate text-xs font-semibold text-foreground">
          {getCurrentSectionLabel()}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <NotificationsBell />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="group flex h-8 items-center gap-2 rounded-full border border-border bg-card pl-1.5 pr-3 text-xs font-semibold text-muted-foreground shadow-sm transition-all hover:bg-accent/50 hover:text-foreground"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-[10px] font-bold text-primary">
                {getInitials(user?.name || 'U')}
              </span>
              <span className="hidden max-w-[100px] truncate text-left font-medium text-foreground sm:inline">
                {user ? user.name : 'Profile'}
              </span>
              <ChevronDown className="size-3 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:translate-y-0.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-48 border-border bg-card text-foreground"
            align="end"
          >
            {user && (
              <>
                <div className="px-2.5 py-2">
                  <p className="truncate text-xs font-bold text-foreground">
                    {user.name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <DropdownMenuSeparator className="bg-border" />
              </>
            )}
            <DropdownMenuItem
              onClick={() => history.push('/preferences')}
              className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs text-foreground hover:bg-accent/50 focus:bg-accent/50"
            >
              <SettingsIcon className="size-3.5" />
              Preferences
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem
              onClick={onLogoutClick}
              disabled={logoutMutation.isPending}
              className="flex cursor-pointer items-center gap-2 px-2.5 py-2 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive"
            >
              <LogOut className="size-3.5" />
              Log Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
