import { Check } from 'lucide-react';

import type { ClientAnnotation } from '@/api';
import { cn } from '@/lib/utils';

import { getInitials } from './comments-utils';

type CommentPinProps = {
  annotation: ClientAnnotation;
  isActive: boolean;
  zoom: number;
  onClick: () => void;
};

/**
 * Figma-style comment pin: a teardrop (rounded square with one sharp corner)
 * anchored bottom-left at the annotation position, counter-scaled so it keeps
 * a constant screen size regardless of canvas zoom.
 */
export function CommentPin({
  annotation,
  isActive,
  zoom,
  onClick,
}: CommentPinProps) {
  const replyCount = Math.max(annotation.comments.length - 1, 0);
  const isResolved = annotation.status === 'resolved';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'pointer-events-auto absolute flex h-8 min-w-8 items-center justify-center gap-1 px-1.5',
        'rounded-full rounded-bl-none border-2 shadow-md transition-transform hover:scale-110',
        isResolved
          ? 'border-border bg-muted text-muted-foreground'
          : 'border-background bg-primary text-primary-foreground',
        isActive && 'ring-2 ring-ring ring-offset-1 ring-offset-background',
      )}
      style={{
        transform: `translate(0, -100%) scale(${1 / zoom})`,
        transformOrigin: 'bottom left',
      }}
      aria-label={`Comment by ${annotation.authorName || 'unknown'}`}
    >
      {isResolved ? (
        <Check size={14} />
      ) : (
        <span className="text-[10px] font-semibold leading-none">
          {getInitials(annotation.authorName || '?')}
        </span>
      )}
      {replyCount > 0 && (
        <span className="text-[10px] font-medium leading-none opacity-80">
          {replyCount + 1}
        </span>
      )}
    </button>
  );
}

type CommentClusterPinProps = {
  count: number;
  zoom: number;
  onClick: () => void;
};

export function CommentClusterPin({
  count,
  zoom,
  onClick,
}: CommentClusterPinProps) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={cn(
        'pointer-events-auto absolute flex h-8 min-w-8 items-center justify-center px-2',
        'rounded-full rounded-bl-none border-2 border-background bg-primary text-primary-foreground',
        'shadow-md transition-transform hover:scale-110',
      )}
      style={{
        transform: `translate(0, -100%) scale(${1 / zoom})`,
        transformOrigin: 'bottom left',
      }}
      aria-label={`${count} comments`}
    >
      <span className="text-[10px] font-semibold leading-none">{count}</span>
    </button>
  );
}
