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
        'animate-fade-in group flex flex-col items-center justify-center p-8 text-center',
        className,
      )}
      {...props}
    >
      {Icon && (
        <div className="relative mb-6 flex size-20 items-center justify-center rounded-full bg-gradient-to-b from-primary/10 to-transparent ring-1 ring-primary/20">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl transition-all duration-700 ease-out group-hover:bg-primary/25 group-hover:blur-3xl" />
          <Icon
            className="relative z-10 size-9 text-primary/80 transition-transform duration-500 ease-out group-hover:scale-110"
            strokeWidth={1.5}
          />
        </div>
      )}
      <h3 className="text-xl font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      {description && (
        <p className="mt-2.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {actionText && onAction && (
        <Button
          onClick={onAction}
          className="mt-8 transition-all duration-300 hover:shadow-md hover:shadow-primary/25"
          variant="default"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}
