import { SmilePlus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui';
import type { ClientReaction } from '@/api';

export const REACTION_EMOJIS = ['👍', '👎', '❤️', '🎉', '👀', '🚀', '😄', '🤔'];

type CommentReactionsProps = {
  reactions: ClientReaction[];
  currentUserId: string | undefined;
  onToggle: (emoji: string) => void;
};

export function CommentReactions({
  reactions,
  currentUserId,
  onToggle,
}: CommentReactionsProps) {
  const grouped = new Map<string, ClientReaction[]>();
  for (const reaction of reactions) {
    const existing = grouped.get(reaction.emoji) ?? [];
    grouped.set(reaction.emoji, [...existing, reaction]);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {[...grouped.entries()].map(([emoji, group]) => {
        const mine = group.some(
          (reaction) => reaction.userId === currentUserId,
        );
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            title={group.map((reaction) => reaction.userName).join(', ')}
            className={cn(
              'flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors',
              mine
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent',
            )}
          >
            <span>{emoji}</span>
            <span className="font-medium">{group.length}</span>
          </button>
        );
      })}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Add reaction"
          >
            <SmilePlus size={12} />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-1.5" align="start">
          <div className="flex gap-0.5">
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onToggle(emoji)}
                className="rounded p-1 text-sm transition-colors hover:bg-accent"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
