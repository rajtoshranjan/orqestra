import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

export type PageLayoutProps = {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  headerAction?: ReactNode;
  className?: string;
  maxWidthClass?: string;
};

export function PageLayout({
  title,
  description,
  children,
  headerAction,
  className,
  maxWidthClass = 'max-w-full',
}: PageLayoutProps) {
  return (
    <div className="relative flex min-h-full flex-col overflow-hidden bg-background font-sans text-foreground">
      <div
        className={cn(
          'relative flex w-full flex-1 flex-col px-8 py-8 sm:px-12 sm:py-10',
          maxWidthClass,
          className,
        )}
      >
        {/* Standardized Page Header */}
        {(title || description || headerAction) && (
          <div className="animate-fade-in relative z-10 mb-8 flex w-full shrink-0 flex-wrap items-start justify-between gap-4">
            <div>
              {title && (
                <h1 className="flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-foreground">
                  {title}
                </h1>
              )}
              {description && (
                <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            {headerAction && <div>{headerAction}</div>}
          </div>
        )}

        {/* Page Content */}
        <div className="relative z-10 w-full flex-1">{children}</div>
      </div>
    </div>
  );
}
