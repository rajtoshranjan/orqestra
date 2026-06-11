import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from './client';
import type { ServerResponse } from './types';

/* Server types for annotation responses. */

export type AnnotationTargetType = 'canvas' | 'node' | 'edge' | 'deployment';
export type AnnotationStatus = 'open' | 'resolved';
export type AnnotationAuthorType = 'user' | 'system' | 'agent';

export type AnnotationPosition = {
  x?: number;
  y?: number;
  dx?: number;
  dy?: number;
};

export type ServerReaction = {
  id: string;
  emoji: string;
  user: string;
  user_name: string;
};

export type ServerComment = {
  id: string;
  annotation: string;
  author: string | null;
  author_name: string;
  author_email: string;
  author_type: AnnotationAuthorType;
  origin: string;
  body: string;
  edited_at: string | null;
  reactions: ServerReaction[];
  mention_user_ids: string[];
  created_at: string;
};

export type ServerAnnotation = {
  id: string;
  project: string;
  target_type: AnnotationTargetType;
  target_id: string;
  position: AnnotationPosition;
  status: AnnotationStatus;
  archived: boolean;
  author: string | null;
  author_name: string;
  author_type: AnnotationAuthorType;
  origin: string;
  resolved_by: string | null;
  resolved_by_name: string;
  resolved_at: string | null;
  comments: ServerComment[];
  created_at: string;
  updated_at: string;
};

/* Client types. */

export type ClientReaction = {
  id: string;
  emoji: string;
  userId: string;
  userName: string;
};

export type ClientComment = {
  id: string;
  annotationId: string;
  authorId: string | null;
  authorName: string;
  authorEmail: string;
  authorType: AnnotationAuthorType;
  origin: string;
  body: string;
  editedAt: string | null;
  reactions: ClientReaction[];
  mentionUserIds: string[];
  createdAt: string;
};

export type ClientAnnotation = {
  id: string;
  projectId: string;
  targetType: AnnotationTargetType;
  targetId: string;
  position: AnnotationPosition;
  status: AnnotationStatus;
  archived: boolean;
  authorId: string | null;
  authorName: string;
  authorType: AnnotationAuthorType;
  origin: string;
  resolvedById: string | null;
  resolvedByName: string;
  resolvedAt: string | null;
  comments: ClientComment[];
  createdAt: string;
  updatedAt: string;
};

export type CreateAnnotationInput = {
  projectId: string;
  targetType: AnnotationTargetType;
  targetId?: string;
  position: AnnotationPosition;
  body: string;
};

/* Mappers. */

const mapServerReaction = (server: ServerReaction): ClientReaction => ({
  id: server.id,
  emoji: server.emoji,
  userId: server.user,
  userName: server.user_name,
});

const mapServerComment = (server: ServerComment): ClientComment => ({
  id: server.id,
  annotationId: server.annotation,
  authorId: server.author,
  authorName: server.author_name,
  authorEmail: server.author_email,
  authorType: server.author_type,
  origin: server.origin,
  body: server.body,
  editedAt: server.edited_at,
  reactions: server.reactions.map(mapServerReaction),
  mentionUserIds: server.mention_user_ids,
  createdAt: server.created_at,
});

const mapServerAnnotation = (server: ServerAnnotation): ClientAnnotation => ({
  id: server.id,
  projectId: server.project,
  targetType: server.target_type,
  targetId: server.target_id,
  position: server.position,
  status: server.status,
  archived: server.archived,
  authorId: server.author,
  authorName: server.author_name,
  authorType: server.author_type,
  origin: server.origin,
  resolvedById: server.resolved_by,
  resolvedByName: server.resolved_by_name,
  resolvedAt: server.resolved_at,
  comments: server.comments.map(mapServerComment),
  createdAt: server.created_at,
  updatedAt: server.updated_at,
});

/* API calls. */

export const fetchProjectAnnotations = async (
  projectId: string,
): Promise<ClientAnnotation[]> => {
  const response = await api.get<ServerResponse<ServerAnnotation[]>>(
    `/annotations/?project=${projectId}`,
  );
  return response.data.data.map(mapServerAnnotation);
};

export const createAnnotation = async (
  input: CreateAnnotationInput,
): Promise<ClientAnnotation> => {
  const response = await api.post<ServerResponse<ServerAnnotation>>(
    '/annotations/',
    {
      project: input.projectId,
      target_type: input.targetType,
      target_id: input.targetId ?? '',
      position: input.position,
      body: input.body,
    },
  );
  return mapServerAnnotation(response.data.data);
};

export const updateAnnotationPosition = async (input: {
  annotationId: string;
  position: AnnotationPosition;
}): Promise<void> => {
  await api.patch(`/annotations/${input.annotationId}/`, {
    position: input.position,
  });
};

export const deleteAnnotation = async (annotationId: string): Promise<void> => {
  await api.delete(`/annotations/${annotationId}/`);
};

const postAnnotationAction = async (
  annotationId: string,
  actionName: 'resolve' | 'reopen' | 'archive' | 'unarchive',
): Promise<ClientAnnotation> => {
  const response = await api.post<ServerResponse<ServerAnnotation>>(
    `/annotations/${annotationId}/${actionName}/`,
  );
  return mapServerAnnotation(response.data.data);
};

export const addComment = async (input: {
  annotationId: string;
  body: string;
}): Promise<ClientComment> => {
  const response = await api.post<ServerResponse<ServerComment>>(
    '/annotations/comments/',
    { annotation: input.annotationId, body: input.body },
  );
  return mapServerComment(response.data.data);
};

export const updateComment = async (input: {
  commentId: string;
  body: string;
}): Promise<ClientComment> => {
  const response = await api.patch<ServerResponse<ServerComment>>(
    `/annotations/comments/${input.commentId}/`,
    { body: input.body },
  );
  return mapServerComment(response.data.data);
};

export const deleteComment = async (commentId: string): Promise<void> => {
  await api.delete(`/annotations/comments/${commentId}/`);
};

export const toggleReaction = async (input: {
  commentId: string;
  emoji: string;
}): Promise<ClientReaction[]> => {
  const response = await api.post<ServerResponse<ServerReaction[]>>(
    `/annotations/comments/${input.commentId}/react/`,
    { emoji: input.emoji },
  );
  return response.data.data.map(mapServerReaction);
};

/* React Query Hooks. */

export const annotationsQueryKey = (projectId: string) =>
  ['annotations', projectId] as const;

/**
 * Single subscription point for a project's annotations.
 *
 * Real-time transport seam: today this polls (matching the deployment
 * polling precedent). A future websocket transport (Django Channels)
 * replaces polling by calling
 * `queryClient.invalidateQueries({ queryKey: annotationsQueryKey(projectId) })`
 * from a socket message handler — no component changes required.
 */
export const useProjectAnnotations = (
  projectId: string | null,
  _options: { poll?: boolean } = {},
) => {
  return useQuery({
    queryKey: annotationsQueryKey(projectId ?? ''),
    queryFn: () => fetchProjectAnnotations(projectId!),
    enabled: !!projectId,
  });
};

const useAnnotationsInvalidatingMutation = <TInput, TResult>(
  projectId: string | null,
  mutationFn: (input: TInput) => Promise<TResult>,
) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      if (projectId) {
        void queryClient.invalidateQueries({
          queryKey: annotationsQueryKey(projectId),
        });
      }
    },
  });
};

export const useCreateAnnotation = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, createAnnotation);

export const useUpdateAnnotationPosition = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, updateAnnotationPosition);

export const useDeleteAnnotation = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, deleteAnnotation);

export const useResolveAnnotation = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, (annotationId: string) =>
    postAnnotationAction(annotationId, 'resolve'),
  );

export const useReopenAnnotation = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, (annotationId: string) =>
    postAnnotationAction(annotationId, 'reopen'),
  );

export const useArchiveAnnotation = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, (annotationId: string) =>
    postAnnotationAction(annotationId, 'archive'),
  );

export const useAddComment = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, addComment);

export const useUpdateComment = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, updateComment);

export const useDeleteComment = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, deleteComment);

export const useToggleReaction = (projectId: string | null) =>
  useAnnotationsInvalidatingMutation(projectId, toggleReaction);
