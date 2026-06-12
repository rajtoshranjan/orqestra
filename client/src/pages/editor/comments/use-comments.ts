import { useCallback, useEffect, useMemo, useState } from 'react';

import { useSearchParams } from 'react-router-dom';

import {
  useAddComment,
  useCreateAnnotation,
  useDeleteAnnotation,
  useDeleteComment,
  useGetUserInfo,
  useProjectAnnotations,
  useReopenAnnotation,
  useResolveAnnotation,
  useToggleReaction,
  useUpdateComment,
} from '@/api';
import type {
  AnnotationPosition,
  AnnotationTargetType,
  ClientAnnotation,
} from '@/api';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useProjectSubscription } from '@/hooks/use-project-subscription';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  setActiveAnnotationId,
  setAnnotationFilters,
  setCommentMode,
} from '@/store/ui-slice';
import type { DiagramEdge, DiagramNode, ServiceNodeData } from '@/types';
import { getNodeAbsolutePosition } from '@/utils';

import {
  hitTestEdgeAtFlowPosition,
  hitTestNodeAtFlowPosition,
  isAnnotationDetached,
  resolvePinFlowPosition,
} from './comments-utils';

import type { ReactFlowInstance } from 'reactflow';

export type CommentDraft = {
  targetType: AnnotationTargetType;
  targetId?: string;
  position: AnnotationPosition;
  /** Flow coordinates where the draft composer is anchored. */
  flowPosition: { x: number; y: number };
};

type UseCommentsParams = {
  projectId: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  reactFlowInstance: ReactFlowInstance<ServiceNodeData> | null;
};

export const useComments = ({
  projectId,
  nodes,
  edges,
  reactFlowInstance,
}: UseCommentsParams) => {
  const dispatch = useAppDispatch();
  const { commentMode, reviewMode, activeAnnotationId, annotationFilters } =
    useAppSelector((state) => state.ui);

  const [draft, setDraft] = useState<CommentDraft | null>(null);

  const { data: userInfo } = useGetUserInfo();
  useProjectSubscription(projectId);
  const { data: annotations = [] } = useProjectAnnotations(projectId);

  const createAnnotationMutation = useCreateAnnotation(projectId);
  const addCommentMutation = useAddComment(projectId);
  const updateCommentMutation = useUpdateComment(projectId);
  const deleteCommentMutation = useDeleteComment(projectId);
  const deleteAnnotationMutation = useDeleteAnnotation(projectId);
  const resolveMutation = useResolveAnnotation(projectId);
  const reopenMutation = useReopenAnnotation(projectId);
  const toggleReactionMutation = useToggleReaction(projectId);

  const activeAnnotation = useMemo(
    () =>
      annotations.find((annotation) => annotation.id === activeAnnotationId) ??
      null,
    [annotations, activeAnnotationId],
  );

  /* Filtering */

  const matchesFilters = useCallback(
    (annotation: ClientAnnotation): boolean => {
      if (
        annotationFilters.status !== 'all' &&
        annotation.status !== annotationFilters.status
      ) {
        return false;
      }
      if (annotationFilters.onlyMine && annotation.authorId !== userInfo?.id) {
        return false;
      }
      if (
        annotationFilters.onlyMentions &&
        !annotation.comments.some((comment) =>
          comment.mentionUserIds.includes(userInfo?.id ?? ''),
        )
      ) {
        return false;
      }
      return true;
    },
    [annotationFilters, userInfo?.id],
  );

  const filteredAnnotations = useMemo(
    () => annotations.filter(matchesFilters),
    [annotations, matchesFilters],
  );

  /** Annotations rendered as pins: filtered, attached, resolved only in review mode. */
  const pinnedAnnotations = useMemo(
    () =>
      filteredAnnotations.filter((annotation) => {
        if (isAnnotationDetached(annotation, nodes, edges)) return false;
        if (annotation.targetType === 'deployment') return false;
        if (annotation.status === 'resolved') {
          return reviewMode || annotationFilters.status !== 'open';
        }
        return true;
      }),
    [filteredAnnotations, nodes, edges, reviewMode, annotationFilters.status],
  );

  /* Thread open/close */

  const openThread = useCallback(
    (annotationId: string) => {
      dispatch(setActiveAnnotationId(annotationId));
      setDraft(null);
    },
    [dispatch],
  );

  const closeThread = useCallback(() => {
    dispatch(setActiveAnnotationId(null));
  }, [dispatch]);

  /* Draft creation */

  const startDraftAtFlowPosition = useCallback(
    (flowPosition: { x: number; y: number }) => {
      const node = hitTestNodeAtFlowPosition(flowPosition, nodes);
      if (node) {
        const absolute = getNodeAbsolutePosition(node, nodes);
        setDraft({
          targetType: 'node',
          targetId: node.id,
          position: {
            dx: flowPosition.x - absolute.x,
            dy: flowPosition.y - absolute.y,
          },
          flowPosition,
        });
      } else {
        const edge = hitTestEdgeAtFlowPosition(flowPosition, nodes, edges);
        if (edge) {
          setDraft({
            targetType: 'edge',
            targetId: edge.id,
            position: {},
            flowPosition,
          });
        } else {
          setDraft({
            targetType: 'canvas',
            position: { x: flowPosition.x, y: flowPosition.y },
            flowPosition,
          });
        }
      }
      dispatch(setActiveAnnotationId(null));
    },
    [nodes, edges, dispatch],
  );

  const startDraftAtScreenPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!reactFlowInstance) return;
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: clientX,
        y: clientY,
      });
      startDraftAtFlowPosition(flowPosition);
    },
    [reactFlowInstance, startDraftAtFlowPosition],
  );

  const startDraftForNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node) return;
      const absolute = getNodeAbsolutePosition(node, nodes);
      const dx = (node.width ?? 200) - 12;
      setDraft({
        targetType: 'node',
        targetId: node.id,
        position: { dx, dy: 12 },
        flowPosition: { x: absolute.x + dx, y: absolute.y + 12 },
      });
      dispatch(setActiveAnnotationId(null));
    },
    [nodes, dispatch],
  );

  const cancelDraft = useCallback(() => setDraft(null), []);

  const submitDraft = useCallback(
    async (body: string) => {
      if (!draft) return;
      const annotation = await createAnnotationMutation.mutateAsync({
        projectId,
        targetType: draft.targetType,
        targetId: draft.targetId,
        position: draft.position,
        body,
      });
      setDraft(null);
      dispatch(setActiveAnnotationId(annotation.id));
    },
    [draft, createAnnotationMutation, projectId, dispatch],
  );

  /* Navigation */

  const jumpToAnnotation = useCallback(
    (annotationId: string) => {
      const annotation = annotations.find((a) => a.id === annotationId);
      if (!annotation) return;
      dispatch(setActiveAnnotationId(annotationId));
      const flowPosition = resolvePinFlowPosition(annotation, nodes, edges);
      if (flowPosition && reactFlowInstance) {
        const currentZoom = reactFlowInstance.getViewport().zoom;
        reactFlowInstance.setCenter(flowPosition.x, flowPosition.y, {
          zoom: Math.max(currentZoom, 1),
          duration: 400,
        });
      }
    },
    [annotations, nodes, edges, reactFlowInstance, dispatch],
  );

  /** Deep-link support: `?annotation=<id>` (set by the global notifications
   * bell) opens the thread, reveals it in the sidebar, and centers the
   * canvas on it once the annotation has loaded. */
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    const targetAnnotationId = searchParams.get('annotation');
    if (!targetAnnotationId) return;
    const annotation = annotations.find((a) => a.id === targetAnnotationId);
    if (!annotation) return;

    dispatch(setActiveAnnotationId(annotation.id));
    dispatch(setCommentMode(true));
    if (annotation.status === 'resolved') {
      dispatch(setAnnotationFilters({ status: 'all' }));
    }

    const flowPosition = resolvePinFlowPosition(annotation, nodes, edges);
    if (flowPosition && reactFlowInstance) {
      reactFlowInstance.setCenter(flowPosition.x, flowPosition.y, {
        zoom: Math.max(reactFlowInstance.getViewport().zoom, 1),
        duration: 400,
      });
    }

    setSearchParams(
      (params) => {
        params.delete('annotation');
        return params;
      },
      { replace: true },
    );
  }, [
    annotations,
    nodes,
    edges,
    reactFlowInstance,
    searchParams,
    setSearchParams,
    dispatch,
  ]);

  /* Comment mode lifecycle */

  const exitCommentMode = useCallback(() => {
    dispatch(setCommentMode(false));
    setDraft(null);
  }, [dispatch]);

  useKeyboardShortcuts(
    [
      {
        key: 'Escape',
        description: 'Exit comment mode',
        category: 'canvas',
        disabled: !commentMode && !draft && !activeAnnotationId,
        handler: () => {
          if (draft) {
            setDraft(null);
            return;
          }
          if (activeAnnotationId) {
            closeThread();
            return;
          }
          exitCommentMode();
        },
      },
    ],
    [commentMode, draft, activeAnnotationId, closeThread, exitCommentMode],
  );

  /* Thread actions */

  const reply = useCallback(
    (body: string) => {
      if (!activeAnnotationId) return;
      addCommentMutation.mutate({ annotationId: activeAnnotationId, body });
    },
    [activeAnnotationId, addCommentMutation],
  );

  const deleteActiveAnnotation = useCallback(() => {
    if (!activeAnnotationId) return;
    deleteAnnotationMutation.mutate(activeAnnotationId);
    closeThread();
  }, [activeAnnotationId, deleteAnnotationMutation, closeThread]);

  const openSidebar = useCallback(
    () => dispatch(setCommentMode(true)),
    [dispatch],
  );

  return {
    annotations,
    filteredAnnotations,
    pinnedAnnotations,
    activeAnnotation,
    currentUserId: userInfo?.id,
    isDetached: useCallback(
      (annotation: ClientAnnotation) =>
        isAnnotationDetached(annotation, nodes, edges),
      [nodes, edges],
    ),

    draft,
    startDraftAtScreenPosition,
    startDraftAtFlowPosition,
    startDraftForNode,
    cancelDraft,
    submitDraft,
    isCreating: createAnnotationMutation.isPending,

    openThread,
    closeThread,
    jumpToAnnotation,
    openSidebar,
    exitCommentMode,

    reply,
    isReplying: addCommentMutation.isPending,
    resolve: useCallback(
      (annotationId: string) => resolveMutation.mutate(annotationId),
      [resolveMutation],
    ),
    reopen: useCallback(
      (annotationId: string) => reopenMutation.mutate(annotationId),
      [reopenMutation],
    ),
    editComment: useCallback(
      (commentId: string, body: string) =>
        updateCommentMutation.mutate({ commentId, body }),
      [updateCommentMutation],
    ),
    deleteComment: useCallback(
      (commentId: string) => deleteCommentMutation.mutate(commentId),
      [deleteCommentMutation],
    ),
    toggleReaction: useCallback(
      (commentId: string, emoji: string) =>
        toggleReactionMutation.mutate({ commentId, emoji }),
      [toggleReactionMutation],
    ),
    deleteActiveAnnotation,
  };
};

export type CommentsApi = ReturnType<typeof useComments>;
