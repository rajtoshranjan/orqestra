import { useState } from 'react';

import { AtSign, Bell, Check, MessageSquare, Reply } from 'lucide-react';

import {
  useMarkNotificationsRead,
  useNotifications,
  useUnreadNotificationCount,
} from '@/api';
import type { ClientNotification, NotificationVerb } from '@/api';
import { cn, history } from '@/lib/utils';
import { commentBodyToPlainText, formatRelativeTime } from '@/utils';

import { Button, Popover, PopoverContent, PopoverTrigger } from './ui';

const VERB_META: Record<
  NotificationVerb,
  { label: string; icon: typeof Bell }
> = {
  mentioned: { label: 'mentioned you', icon: AtSign },
  replied: { label: 'replied', icon: Reply },
  resolved: { label: 'resolved your comment', icon: Check },
};

/**
 * Global, account-wide notification center shown in the app header.
 * Surfaces mentions/replies/resolutions across every project in the
 * active organisation; clicking jumps into the relevant project's
 * canvas and opens the discussion thread.
 */
type NotificationsBellProps = {
  /** Optional callback to jump to the annotation when inside the project/canvas editor. */
  onOpenAnnotation?: (annotationId: string, projectId: string) => void;
};

export function NotificationsBell({
  onOpenAnnotation,
}: NotificationsBellProps = {}) {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useNotifications(open);
  const { data: unreadCount = 0 } = useUnreadNotificationCount();
  const markReadMutation = useMarkNotificationsRead();

  const handleClick = (notification: ClientNotification) => {
    if (!notification.readAt) {
      markReadMutation.mutate({ ids: [notification.id] });
    }
    if (notification.annotationId) {
      if (onOpenAnnotation) {
        onOpenAnnotation(notification.annotationId, notification.projectId);
      } else {
        history.push(
          `/editor/${encodeURIComponent(notification.projectId)}?annotation=${encodeURIComponent(notification.annotationId)}`,
        );
      }
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="relative size-8 p-0"
          aria-label="Notifications"
        >
          <Bell size={15} />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[9px] font-semibold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-2">
          <span className="text-xs font-semibold text-foreground">
            Notifications
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              type="button"
              className="h-6 px-2 text-[11px] text-muted-foreground"
              onClick={() => markReadMutation.mutate({ all: true })}
            >
              Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <MessageSquare size={18} className="text-muted-foreground" />
              <p className="text-xs text-muted-foreground">
                Mentions, replies, and resolutions across your projects show up
                here.
              </p>
            </div>
          ) : (
            notifications.map((notification) => {
              const meta = VERB_META[notification.verb];
              const Icon = meta.icon;
              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => handleClick(notification)}
                  className={cn(
                    'flex w-full items-start gap-2.5 border-b border-border/40 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/50',
                    !notification.readAt && 'bg-primary/5',
                  )}
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full',
                      notification.readAt
                        ? 'bg-muted text-muted-foreground'
                        : 'bg-primary/15 text-primary',
                    )}
                  >
                    <Icon size={12} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs text-foreground">
                      <span className="font-medium">
                        {notification.actorName || 'Someone'}
                      </span>{' '}
                      {meta.label}
                    </span>
                    {notification.preview && (
                      <span className="mt-0.5 line-clamp-2 block text-[11px] text-muted-foreground">
                        {commentBodyToPlainText(notification.preview)}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {formatRelativeTime(notification.createdAt)}
                    </span>
                  </span>
                  {!notification.readAt && (
                    <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
