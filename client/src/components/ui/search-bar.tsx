import * as React from 'react';
import { Search } from 'lucide-react';

import { Input } from './input';
import { cn } from '@/lib/utils';

type SearchBarProps = React.InputHTMLAttributes<HTMLInputElement> & {
  wrapperClassName?: string;
};

export const SearchBar = React.forwardRef<HTMLInputElement, SearchBarProps>(
  ({ className, wrapperClassName, ...props }, ref) => {
    return (
      <div className={cn('relative w-full max-w-sm', wrapperClassName)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={ref}
          type="search"
          className={cn('pl-9 pr-4', className)}
          {...props}
        />
      </div>
    );
  },
);
SearchBar.displayName = 'SearchBar';
