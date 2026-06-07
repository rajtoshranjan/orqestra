import type { ComponentType } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocalStorage } from 'usehooks-ts';
import {
  LayoutDashboard,
  Hexagon,
  PanelLeftClose,
  PanelLeftOpen,
  Settings as SettingsIcon,
} from 'lucide-react';

import { cn } from '@/lib/utils';

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

  return (
    <aside
      className={cn(
        'flex min-h-screen w-14 shrink-0 flex-col border-r border-border bg-[var(--color-bg-surface)] text-card-foreground transition-all duration-300',
        isCollapsed ? 'md:w-14' : 'md:w-44',
      )}
    >
      {/* Sidebar Top: Logo & Title */}
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

      {/* Sidebar Middle: Navigation Links */}
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
                <span className="hidden truncate md:inline">{item.label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar Bottom: Collapse Toggle Button */}
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
  );
}
