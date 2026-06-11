import * as React from 'react';
import { LucideIcon } from 'lucide-react';

import { Button } from './button';
import { cn } from '@/lib/utils';

type EmptyStateProps = React.HTMLAttributes<HTMLDivElement> & {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actionText?: string;
  size?: 'sm' | 'md' | 'lg';
  onAction?: () => void;
};

const sizeStyles = {
  sm: {
    container: 'p-4',
    iconWrapper: 'mb-4 size-12',
    icon: 'size-5',
    title: 'text-base',
    description: 'mt-1.5 max-w-xs text-xs',
    button: 'mt-4',
  },
  md: {
    container: 'p-6',
    iconWrapper: 'mb-5 size-16',
    icon: 'size-7',
    title: 'text-lg',
    description: 'mt-2 max-w-sm text-sm',
    button: 'mt-6',
  },
  lg: {
    container: 'p-8',
    iconWrapper: 'mb-6 size-20',
    icon: 'size-9',
    title: 'text-xl',
    description: 'mt-2.5 max-w-sm text-sm',
    button: 'mt-8',
  },
} as const;

export function EmptyState({
  title,
  description,
  icon: Icon,
  actionText,
  onAction,
  className,
  size = 'lg',
  ...props
}: EmptyStateProps) {
  const styles = sizeStyles[size];

  return (
    <div
      className={cn(
        'animate-fade-in group flex flex-col items-center justify-center text-center',
        styles.container,
        className,
      )}
      {...props}
    >
      {Icon && (
        <div
          className={cn(
            'relative flex items-center justify-center rounded-full bg-gradient-to-b from-primary/10 to-transparent ring-1 ring-primary/20',
            styles.iconWrapper,
          )}
        >
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl transition-all duration-700 ease-out group-hover:bg-primary/25 group-hover:blur-3xl" />
          <Icon
            className={cn(
              'relative z-10 text-primary/80 transition-transform duration-500 ease-out group-hover:scale-110',
              styles.icon,
            )}
            strokeWidth={1.5}
          />
        </div>
      )}

      <h3
        className={cn(
          'font-semibold tracking-tight text-foreground',
          styles.title,
        )}
      >
        {title}
      </h3>

      {description && (
        <p
          className={cn(
            'leading-relaxed text-muted-foreground',
            styles.description,
          )}
        >
          {description}
        </p>
      )}

      {actionText && onAction && (
        <Button
          onClick={onAction}
          className={cn(
            'transition-all duration-300 hover:shadow-md hover:shadow-primary/25',
            styles.button,
          )}
          variant="default"
        >
          {actionText}
        </Button>
      )}
    </div>
  );
}
