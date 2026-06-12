import { useEffect, useRef } from 'react';

import type { MentionableUser } from '@/api';
import { cn } from '@/lib/utils';

import { getInitials } from './comments-utils';

type MentionAutocompleteProps = {
  users: MentionableUser[];
  highlightedIndex: number;
  onHighlight: (index: number) => void;
  onSelect: (user: MentionableUser) => void;
};

/**
 * Suggestion dropdown shown while typing an @mention in the composer.
 * Keyboard handling lives in the composer; this renders the list.
 */
export function MentionAutocomplete({
  users,
  highlightedIndex,
  onHighlight,
  onSelect,
}: MentionAutocompleteProps) {
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const highlighted = listRef.current?.children[highlightedIndex];
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  if (users.length === 0) return null;

  return (
    <div
      ref={listRef}
      className="glass absolute inset-x-0 bottom-full z-50 mb-1 max-h-44 overflow-y-auto rounded-lg border border-border/80 bg-popover p-1 shadow-md"
    >
      {users.map((user, index) => (
        <button
          key={user.id}
          type="button"
          onMouseDown={(event) => {
            // Prevent the textarea from losing focus before selection lands.
            event.preventDefault();
            onSelect(user);
          }}
          onMouseEnter={() => onHighlight(index)}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs',
            index === highlightedIndex ? 'bg-accent' : 'hover:bg-accent/60',
          )}
        >
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
            {getInitials(user.name)}
          </span>
          <span className="truncate font-medium text-foreground">
            {user.name}
          </span>
          <span className="ml-auto truncate text-[10px] text-muted-foreground">
            {user.email}
          </span>
        </button>
      ))}
    </div>
  );
}
