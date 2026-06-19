import { MessageSquare, Unlink } from 'lucide-react';

import type { ClientAnnotation } from '@/api';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils';

import { commentBodyToPlainText, getInitials } from './comments-utils';

const TARGET_LABELS: Record<ClientAnnotation['targetType'], string> = {
  canvas: 'Canvas',
  node: 'Resource',
  edge: 'Connection',
  deployment: 'Deployment',
};

type AnnotationCardProps = {
  annotation: ClientAnnotation;
  isActive: boolean;
  isDetached: boolean;
  onClick: () => void;
};

export function AnnotationCard({
  annotation,
  isActive,
  isDetached,
  onClick,
}: AnnotationCardProps) {
  const rootComment = annotation.comments[0];
  const replyCount = Math.max(annotation.comments.length - 1, 0);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'w-full rounded-lg border p-2.5 text-left transition-colors',
        isActive
          ? 'border-primary/50 bg-primary/5'
          : 'border-border/60 hover:bg-accent/40',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[9px] font-semibold text-primary">
          {getInitials(annotation.authorName || '?')}
        </span>
        <span className="truncate text-xs font-medium text-foreground">
          {annotation.authorName || 'Unknown'}
        </span>
        <span className="ml-auto shrink-0 text-[10px] text-muted-foreground">
          {formatRelativeTime(annotation.updatedAt)}
        </span>
      </div>

      {rootComment && (
        <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">
          {commentBodyToPlainText(rootComment.body)}
        </p>
      )}

      <div className="mt-1.5 flex items-center gap-1.5">
        <Badge variant="outline" className="px-1.5 py-0 text-[9px]">
          {TARGET_LABELS[annotation.targetType]}
        </Badge>
        {annotation.status === 'resolved' && (
          <Badge className="bg-success/15 px-1.5 py-0 text-[9px] text-success">
            Resolved
          </Badge>
        )}
        {isDetached && (
          <Badge className="bg-warning/15 gap-0.5 px-1.5 py-0 text-[9px] text-warning">
            <Unlink size={8} /> Detached
          </Badge>
        )}
        {replyCount > 0 && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
            <MessageSquare size={10} />
            {replyCount}
          </span>
        )}
      </div>
    </button>
  );
}
