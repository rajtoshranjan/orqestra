import * as React from 'react';
import { LucideIcon } from 'lucide-react';

import { Button } from './button';
import { cn } from '@/lib/utils';

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
};

export function EmptyState({
  title,
  description,
  icon: Icon,
  actionText,
  onAction,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'animate-fade-in flex flex-col items-center justify-center p-8 text-center',
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-secondary/50 text-muted-foreground">
          <Icon className="size-8" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <Button onClick={onAction} className="mt-6" variant="default">
          {actionText}
        </Button>
      )}
    </div>
  );
}
