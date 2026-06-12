import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from './client';

import type { ServerResponse } from './types';

export type NotificationVerb = 'mentioned' | 'replied' | 'resolved';

export type ServerNotification = {
  id: string;
  verb: NotificationVerb;
  actor: string | null;
  actor_name: string;
  annotation: string | null;
  comment: string | null;
  project_id: string;
  preview: string;
  read_at: string | null;
  created_at: string;
};

export type ClientNotification = {
  id: string;
  verb: NotificationVerb;
  actorId: string | null;
  actorName: string;
  annotationId: string | null;
  commentId: string | null;
  projectId: string;
  preview: string;
  readAt: string | null;
  createdAt: string;
};

const mapServerNotification = (
  server: ServerNotification,
): ClientNotification => ({
  id: server.id,
  verb: server.verb,
  actorId: server.actor,
  actorName: server.actor_name,
  annotationId: server.annotation,
  commentId: server.comment,
  projectId: server.project_id,
  preview: server.preview,
  readAt: server.read_at,
  createdAt: server.created_at,
});

/* API calls. */

export const fetchNotifications = async (): Promise<ClientNotification[]> => {
  const response = await api.get<ServerResponse<ServerNotification[]>>(
    '/annotations/notifications/',
  );
  return response.data.data.map(mapServerNotification);
};

export const fetchUnreadNotificationCount = async (): Promise<number> => {
  const response = await api.get<ServerResponse<{ count: number }>>(
    '/annotations/notifications/unread-count/',
  );
  return response.data.data.count;
};

export const markNotificationsRead = async (
  input: { ids: string[] } | { all: true },
): Promise<void> => {
  await api.post('/annotations/notifications/mark-read/', input);
};

/* React Query Hooks. */

export const useNotifications = (enabled = true) => {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: fetchNotifications,
    enabled,
  });
};

export const useUnreadNotificationCount = () => {
  return useQuery({
    queryKey: ['notificationUnreadCount'],
    queryFn: fetchUnreadNotificationCount,
  });
};

export const useMarkNotificationsRead = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: markNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      void queryClient.invalidateQueries({
        queryKey: ['notificationUnreadCount'],
      });
    },
  });
};
