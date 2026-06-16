import * as React from 'react';

import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type MetaChipProps = React.HTMLAttributes<HTMLSpanElement> & {
  icon?: LucideIcon;
};

const MetaChip = React.forwardRef<HTMLSpanElement, MetaChipProps>(
  ({ className, icon: Icon, children, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex select-none items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground',
        className,
      )}
      {...props}
    >
      {Icon ? <Icon className="size-3 text-muted-foreground" /> : null}
      {children}
    </span>
  ),
);
MetaChip.displayName = 'MetaChip';

export { MetaChip };
