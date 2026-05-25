import * as React from 'react';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

type LoadingStateProps = React.HTMLAttributes<HTMLDivElement> & {
  message?: string;
  variant?: 'spinner' | 'skeleton-grid' | 'skeleton-card';
  count?: number;
};

export function LoadingState({
  message,
  variant = 'spinner',
  count = 3,
  className,
  ...props
}: LoadingStateProps) {
  if (variant === 'skeleton-grid') {
    return (
      <div
        className={cn(
          'stagger-children grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3',
          className,
        )}
        {...props}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex h-44 animate-pulse flex-col justify-between rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className="space-y-2">
              <div className="h-5 w-2/3 rounded bg-muted" />
              <div className="h-4 w-1/2 rounded bg-muted/60" />
            </div>
            <div className="flex items-center justify-between">
              <div className="h-4 w-1/4 rounded bg-muted" />
              <div className="size-6 rounded-full bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'skeleton-card') {
    return (
      <div
        className={cn('flex w-full animate-pulse flex-col gap-2', className)}
        {...props}
      >
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="h-16 w-full rounded-md border border-border bg-card/60 p-4"
          >
            <div className="h-4 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 py-12',
        className,
      )}
      {...props}
    >
      <div className="relative flex size-16 items-center justify-center">
        <div className="absolute size-full animate-ping rounded-full bg-primary/30 opacity-75"></div>
        <Loader2 className="relative size-12 animate-spin text-primary" />
      </div>
      {message && (
        <div className="animate-pulse text-sm font-medium tracking-wide text-muted-foreground">
          {message}
        </div>
      )}
    </div>
  );
}
