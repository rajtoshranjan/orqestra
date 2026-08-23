import { useEffect, useRef, useState } from 'react';

import {
  Check,
  MoreHorizontal,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import type { ClientAnnotation, ClientComment } from '@/api';
import {
  Badge,
  Button,
  ConfirmDialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui';
import { usePermissions } from '@/hooks';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils';

import { CommentBody } from './comment-body';
import { CommentComposer } from './comment-composer';
import { CommentReactions } from './comment-reactions';
import { getInitials } from './comments-utils';

type ThreadActions = {
  onReply: (body: string) => void;
  onResolve: () => void;
  onReopen: () => void;
  onDeleteAnnotation: () => void;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
};

type CommentThreadPopoverProps = ThreadActions & {
  annotation: ClientAnnotation;
  currentUserId: string | undefined;
  isSubmitting: boolean;
  onClose: () => void;
};

const TARGET_LABELS: Record<ClientAnnotation['targetType'], string> = {
  canvas: 'Canvas',
  node: 'Resource',
  edge: 'Connection',
  deployment: 'Deployment',
};

function ThreadComment({
  comment,
  currentUserId,
  canModerate,
  onEditComment,
  onDeleteComment,
  onToggleReaction,
}: {
  comment: ClientComment;
  currentUserId: string | undefined;
  canModerate: boolean;
  onEditComment: (commentId: string, body: string) => void;
  onDeleteComment: (commentId: string) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const isOwn = comment.authorId !== null && comment.authorId === currentUserId;
  // Authors may edit/delete their own comment; owners/admins may moderate
  // (delete) anyone's. Non-authors without moderation get no menu.
  const canDelete = isOwn || canModerate;

  const isAgent = comment.authorType === 'agent';
  const displayName = isAgent ? 'Orqestra' : comment.authorName || 'Unknown';

  return (
    <div className="group space-y-1.5 px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold',
            isAgent
              ? 'bg-gradient-to-br from-[#7156FB] to-[#9C86FF] text-white shadow-sm'
              : 'bg-primary/15 text-primary',
          )}
        >
          {isAgent ? (
            <Sparkles size={12} />
          ) : (
            getInitials(comment.authorName || '?')
          )}
        </span>
        <span className="truncate text-xs font-medium text-foreground">
          {displayName}
        </span>
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatRelativeTime(comment.createdAt)}
          {comment.editedAt && ' (edited)'}
        </span>

        {canDelete && !isEditing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="ml-auto rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent group-hover:opacity-100"
                aria-label="Comment actions"
              >
                <MoreHorizontal size={14} />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {isOwn && (
                <DropdownMenuItem onClick={() => setIsEditing(true)}>
                  <Pencil size={12} className="mr-2" /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => onDeleteComment(comment.id)}
              >
                <Trash2 size={12} className="mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isEditing ? (
        <CommentComposer
          initialValue={comment.body}
          submitLabel="Save"
          onSubmit={(body) => {
            onEditComment(comment.id, body);
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <>
          <CommentBody body={comment.body} />
          <CommentReactions
            reactions={comment.reactions}
            currentUserId={currentUserId}
            onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
          />
        </>
      )}
    </div>
  );
}

export function CommentThreadPopover({
  annotation,
  currentUserId,
  isSubmitting,
  onClose,
  onReply,
  onResolve,
  onReopen,
  onDeleteAnnotation,
  onEditComment,
  onDeleteComment,
  onToggleReaction,
}: CommentThreadPopoverProps) {
  const { canWrite, canModerate } = usePermissions();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const isResolved = annotation.status === 'resolved';
  const isOwn =
    annotation.authorId !== null && annotation.authorId === currentUserId;
  // Write-roles may resolve/reopen any thread; guests only their own.
  const canResolve = canWrite || isOwn;
  // Thread authors may delete their thread; owners/admins may moderate any.
  const canDeleteThread = isOwn || canModerate;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevCommentsLengthRef = useRef(annotation.comments.length);

  const scrollToBottom = (behavior: ScrollBehavior = 'auto') => {
    const container = scrollContainerRef.current;
    if (container) {
      container.scrollTo({
        top: container.scrollHeight,
        behavior,
      });
    }
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const threshold = 15;
    const isAtBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <=
      threshold;
    isAtBottomRef.current = isAtBottom;
  };

  // Scroll to bottom on mount or when switching active annotations
  useEffect(() => {
    scrollToBottom('auto');
    isAtBottomRef.current = true;
    prevCommentsLengthRef.current = annotation.comments.length;
  }, [annotation.id]);

  // Scroll to bottom when a new comment is added, if appropriate
  useEffect(() => {
    const prevLength = prevCommentsLengthRef.current;
    const currentLength = annotation.comments.length;
    prevCommentsLengthRef.current = currentLength;

    if (currentLength > prevLength) {
      const lastComment = annotation.comments[currentLength - 1];
      const isOwnNewComment =
        lastComment && lastComment.authorId === currentUserId;

      if (isAtBottomRef.current || isOwnNewComment) {
        const timeoutId = setTimeout(() => {
          scrollToBottom('smooth');
          isAtBottomRef.current = true;
        }, 50);
        return () => clearTimeout(timeoutId);
      }
    }
  }, [annotation.comments.length, currentUserId]);

  return (
    <div
      className="glass animate-scale-in flex max-h-[420px] w-80 flex-col overflow-hidden rounded-lg border border-border/80 bg-popover shadow-lg"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <Badge variant="outline" className="text-[10px]">
          {TARGET_LABELS[annotation.targetType]}
        </Badge>
        {isResolved && (
          <Badge className="bg-success/15 text-[10px] text-success">
            Resolved
          </Badge>
        )}
        {annotation.origin && (
          <Badge variant="outline" className="text-[10px]">
            {annotation.origin}
          </Badge>
        )}

        <div className="ml-auto flex items-center gap-1">
          {canResolve &&
            (isResolved ? (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="h-6 gap-1 px-2 text-[11px]"
                onClick={onReopen}
              >
                <RotateCcw size={12} /> Reopen
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="h-6 gap-1 px-2 text-[11px] text-success hover:text-success"
                onClick={onResolve}
              >
                <Check size={12} /> Resolve
              </Button>
            ))}

          {canDeleteThread && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="size-6 p-0 text-muted-foreground hover:text-destructive"
              onClick={() => setShowDeleteConfirm(true)}
              aria-label="Delete thread"
            >
              <Trash2 size={12} />
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="size-6 p-0 text-muted-foreground"
            onClick={onClose}
            aria-label="Close thread"
          >
            <X size={12} />
          </Button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 divide-y divide-border/40 overflow-y-auto"
      >
        {annotation.comments.map((comment) => (
          <ThreadComment
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            canModerate={canModerate}
            onEditComment={onEditComment}
            onDeleteComment={onDeleteComment}
            onToggleReaction={onToggleReaction}
          />
        ))}
      </div>

      <div className="border-t border-border/60 p-2">
        <CommentComposer
          placeholder="Reply… use @ to mention"
          submitLabel="Reply"
          focusOnMount={false}
          isSubmitting={isSubmitting}
          onSubmit={onReply}
        />
      </div>
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete thread"
        description="Delete this comment thread? This can’t be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={onDeleteAnnotation}
      />
    </div>
  );
}
