import { useMemo } from 'react';
import { MessageSquare, ScanEye, Unlink, X } from 'lucide-react';
import { commentBodyToPlainText, getInitials } from './comments-utils';
import type { CommentsApi } from './use-comments';
import {
  Badge,
  Button,
  EmptyState,
  Tabs,
  TabsList,
  TabsTrigger,
} from '@/components/ui';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setAnnotationFilters,
  setCommentsSidebarOpen,
  toggleReviewMode,
} from '@/store/ui-slice';
import type { ClientAnnotation } from '@/api';
import type { AnnotationStatusFilter } from '@/types';

const TARGET_LABELS: Record<ClientAnnotation['targetType'], string> = {
  canvas: 'Canvas',
  node: 'Resource',
  edge: 'Connection',
  deployment: 'Deployment',
};

function AnnotationCard({
  annotation,
  isActive,
  isDetached,
  onClick,
}: {
  annotation: ClientAnnotation;
  isActive: boolean;
  isDetached: boolean;
  onClick: () => void;
}) {
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
          <Badge className="gap-0.5 bg-warning/15 px-1.5 py-0 text-[9px] text-warning">
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

type CommentsSidebarProps = {
  comments: CommentsApi;
};

export function CommentsSidebar({ comments }: CommentsSidebarProps) {
  const dispatch = useAppDispatch();
  const { annotationFilters, reviewMode, activeAnnotationId } = useAppSelector(
    (state) => state.ui,
  );

  const sorted = useMemo(
    () =>
      [...comments.filteredAnnotations].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      ),
    [comments.filteredAnnotations],
  );

  const openCount = comments.annotations.filter(
    (a) => a.status === 'open',
  ).length;

  return (
    <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
        <MessageSquare size={14} className="text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Comments</h2>
        {openCount > 0 && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {openCount} open
          </Badge>
        )}
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="ml-auto size-6 p-0 text-muted-foreground"
          onClick={() => dispatch(setCommentsSidebarOpen(false))}
          aria-label="Close comments sidebar"
        >
          <X size={14} />
        </Button>
      </div>

      <div className="space-y-2 border-b border-border px-3 py-2">
        <Tabs
          value={annotationFilters.status}
          onValueChange={(value) =>
            dispatch(
              setAnnotationFilters({ status: value as AnnotationStatusFilter }),
            )
          }
        >
          <TabsList className="grid h-8 w-full grid-cols-3">
            <TabsTrigger value="open" className="text-[11px]">
              Open
            </TabsTrigger>
            <TabsTrigger value="resolved" className="text-[11px]">
              Resolved
            </TabsTrigger>
            <TabsTrigger value="all" className="text-[11px]">
              All
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              dispatch(
                setAnnotationFilters({ onlyMine: !annotationFilters.onlyMine }),
              )
            }
            className={cn(
              'inline-flex h-5 items-center rounded-full border px-2 text-[10px] leading-none transition-colors',
              annotationFilters.onlyMine
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            Mine
          </button>
          <button
            type="button"
            onClick={() =>
              dispatch(
                setAnnotationFilters({
                  onlyMentions: !annotationFilters.onlyMentions,
                }),
              )
            }
            className={cn(
              'inline-flex h-5 items-center rounded-full border px-2 text-[10px] leading-none transition-colors',
              annotationFilters.onlyMentions
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            Mentions me
          </button>
          <button
            type="button"
            onClick={() => dispatch(toggleReviewMode())}
            aria-pressed={reviewMode}
            className={cn(
              'ml-auto inline-flex h-5 items-center gap-1 rounded-full border px-2 text-[10px] leading-none transition-colors',
              reviewMode
                ? 'border-primary/40 bg-primary/15 text-primary'
                : 'border-border text-muted-foreground hover:bg-accent',
            )}
            title="Toggle Review Mode"
          >
            <ScanEye size={11} />
            Review
          </button>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {sorted.length === 0 ? (
          <EmptyState
            icon={MessageSquare}
            title="No comments"
            description="Press C and click anywhere on the canvas to start a discussion."
          />
        ) : (
          sorted.map((annotation) => (
            <AnnotationCard
              key={annotation.id}
              annotation={annotation}
              isActive={annotation.id === activeAnnotationId}
              isDetached={comments.isDetached(annotation)}
              onClick={() => comments.jumpToAnnotation(annotation.id)}
            />
          ))
        )}
      </div>
    </aside>
  );
}
