import { Moon, Sun } from 'lucide-react';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { PageLayout } from '@/components';
import { cn } from '@/lib/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import { setTheme } from '@/store/ui-slice';

const themeOptions = [
  {
    value: 'dark',
    label: 'Dark',
    description: 'Use the darker canvas-oriented interface.',
    icon: Moon,
  },
  {
    value: 'light',
    label: 'Light',
    description: 'Use the brighter workspace interface.',
    icon: Sun,
  },
] as const;

export function Preferences() {
  const dispatch = useAppDispatch();
  const theme = useAppSelector((state) => state.ui.theme);

  return (
    <PageLayout
      title="Preferences"
      description="Manage workspace preferences for the project dashboard and editor."
      maxWidthClass="max-w-5xl"
    >
      <Card className="w-full rounded-lg border-[var(--color-border)] bg-[var(--color-bg-surface)] shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Choose the color mode used across the workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {themeOptions.map((option) => {
              const Icon = option.icon;
              const active = theme === option.value;

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => dispatch(setTheme(option.value))}
                  aria-pressed={active}
                  className={cn(
                    'flex min-h-[104px] items-start gap-3 rounded-lg border p-4 text-left transition-all duration-200',
                    active
                      ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary'
                      : 'border-[var(--color-border)] bg-[var(--color-bg-surface)] text-muted-foreground hover:border-[var(--color-border-hover)] hover:bg-[var(--color-bg-elevated)] hover:text-foreground',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-9 shrink-0 items-center justify-center rounded-md border',
                      active
                        ? 'border-primary/30 bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground',
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
