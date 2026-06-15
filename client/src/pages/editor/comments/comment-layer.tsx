import { useEffect, useMemo, useRef, useState } from 'react';

import { useViewport } from 'reactflow';

import type { AnnotationTargetType } from '@/api';
import type { DiagramEdge, DiagramNode } from '@/types';
import { getNodeAbsolutePosition, getNodeDimensions } from '@/utils';

import { CommentComposer } from './comment-composer';
import { CommentClusterPin, CommentPin } from './comment-pin';
import { CommentThreadPopover } from './comment-thread-popover';
import {
  CLUSTER_ZOOM_THRESHOLD,
  clusterPins,
  resolvePinFlowPosition,
  hitTestNodeAtFlowPosition,
} from './comments-utils';

import type { PinPlacement } from './comments-utils';
import type { CommentsApi } from './use-comments';

const POPOVER_WIDTH_PX = 320;
const POPOVER_MAX_HEIGHT_PX = 420;
const POPOVER_OFFSET_PX = 12;
const POPOVER_MARGIN_PX = 8;

const COMMENT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 36 36">' +
    '<defs>' +
    '<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">' +
    '<feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.4" flood-color="black"/>' +
    '</filter>' +
    '</defs>' +
    '<path d="M 5.5 30.5 L 5.5 18 A 12.5 12.5 0 0 1 18 5.5 A 12.5 12.5 0 0 1 30.5 18 A 12.5 12.5 0 0 1 18 30.5 L 5.5 30.5 Z" fill="#6366f1" stroke="white" stroke-width="2" filter="url(#shadow)"/>' +
    '</svg>',
)}") 4 32, pointer`;

const useContainerSize = (ref: React.RefObject<HTMLDivElement>) => {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      setSize({ width: element.clientWidth, height: element.clientHeight });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
};

type CommentLayerProps = {
  comments: CommentsApi;
  commentMode: boolean;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
};

/**
 * Canvas overlay rendering comment pins and thread popovers.
 *
 * Pins live inside a div that mirrors the ReactFlow viewport transform
 * (translate + scale) so they sit at flow coordinates; each pin counter-scales
 * by 1/zoom to keep a constant screen size, like Figma. Annotations are never
 * part of the graph state, so they cannot leak into autosave, copy/paste,
 * validation, or auto-layout.
 */
export function CommentLayer({
  comments,
  commentMode,
  nodes,
  edges,
}: CommentLayerProps) {
  const viewport = useViewport();
  const containerRef = useRef<HTMLDivElement>(null);
  const containerSize = useContainerSize(containerRef);

  const [localPositions, setLocalPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

  const placements = useMemo<PinPlacement[]>(() => {
    return comments.pinnedAnnotations.flatMap((annotation) => {
      const position = resolvePinFlowPosition(annotation, nodes, edges);
      if (!position) return [];
      const override = localPositions[annotation.id];
      return [
        {
          annotation,
          x: override ? override.x : position.x,
          y: override ? override.y : position.y,
        },
      ];
    });
  }, [comments.pinnedAnnotations, nodes, edges, localPositions]);

  // Clear local position override when the database annotation position matches or is close to the local override position
  useEffect(() => {
    setLocalPositions((prev) => {
      let hasChanges = false;
      const next = { ...prev };
      for (const [id, localPos] of Object.entries(prev)) {
        const annotation = comments.pinnedAnnotations.find((a) => a.id === id);
        if (annotation) {
          const resolved = resolvePinFlowPosition(annotation, nodes, edges);
          if (
            resolved &&
            Math.abs(resolved.x - localPos.x) < 1 &&
            Math.abs(resolved.y - localPos.y) < 1
          ) {
            delete next[id];
            hasChanges = true;
          }
        } else {
          delete next[id];
          hasChanges = true;
        }
      }
      return hasChanges ? next : prev;
    });
  }, [comments.pinnedAnnotations, nodes, edges]);

  const shouldCluster = viewport.zoom < CLUSTER_ZOOM_THRESHOLD;
  const clusters = useMemo(
    () => (shouldCluster ? clusterPins(placements, viewport.zoom) : []),
    [shouldCluster, placements, viewport.zoom],
  );

  const toScreen = (flowPosition: { x: number; y: number }) => ({
    x: flowPosition.x * viewport.zoom + viewport.x,
    y: flowPosition.y * viewport.zoom + viewport.y,
  });

  const clampPopover = (screen: { x: number; y: number }) => ({
    left: Math.max(
      POPOVER_MARGIN_PX,
      Math.min(
        screen.x + POPOVER_OFFSET_PX,
        Math.max(
          containerSize.width - POPOVER_WIDTH_PX - POPOVER_MARGIN_PX,
          POPOVER_MARGIN_PX,
        ),
      ),
    ),
    top: Math.max(
      POPOVER_MARGIN_PX,
      Math.min(
        screen.y + POPOVER_OFFSET_PX,
        Math.max(
          containerSize.height - POPOVER_MAX_HEIGHT_PX - POPOVER_MARGIN_PX,
          POPOVER_MARGIN_PX,
        ),
      ),
    ),
  });

  const activeFlowPosition = comments.activeAnnotation
    ? resolvePinFlowPosition(comments.activeAnnotation, nodes, edges)
    : null;

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragStartMouse, setDragStartMouse] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragStartPinFlow, setDragStartPinFlow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [dragCurrentPinFlow, setDragCurrentPinFlow] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [hasDragged, setHasDragged] = useState(false);

  const hoveredNode = useMemo(() => {
    if (!draggedId || !dragCurrentPinFlow) return null;
    return hitTestNodeAtFlowPosition(dragCurrentPinFlow, nodes);
  }, [draggedId, dragCurrentPinFlow, nodes]);

  const handlePointerDown = (
    event: React.PointerEvent,
    annotationId: string,
    initialFlowX: number,
    initialFlowY: number,
  ) => {
    if (event.button !== 0) return;
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    target.setPointerCapture(event.pointerId);

    setDraggedId(annotationId);
    setDragStartMouse({ x: event.clientX, y: event.clientY });
    setDragStartPinFlow({ x: initialFlowX, y: initialFlowY });
    setDragCurrentPinFlow({ x: initialFlowX, y: initialFlowY });
    setHasDragged(false);
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!draggedId || !dragStartMouse || !dragStartPinFlow) return;
    event.stopPropagation();

    const deltaX = event.clientX - dragStartMouse.x;
    const deltaY = event.clientY - dragStartMouse.y;

    const flowDeltaX = deltaX / viewport.zoom;
    const flowDeltaY = deltaY / viewport.zoom;

    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasDragged(true);
    }

    setDragCurrentPinFlow({
      x: dragStartPinFlow.x + flowDeltaX,
      y: dragStartPinFlow.y + flowDeltaY,
    });
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    if (!draggedId) return;
    event.stopPropagation();

    const target = event.currentTarget as HTMLElement;
    target.releasePointerCapture(event.pointerId);

    if (hasDragged && dragCurrentPinFlow) {
      const hitNode = hitTestNodeAtFlowPosition(dragCurrentPinFlow, nodes);
      let finalPosition = {};
      let targetType: AnnotationTargetType = 'canvas';
      let targetId = '';

      if (hitNode) {
        targetType = 'node';
        targetId = hitNode.id;
        const nodeAbsolute = getNodeAbsolutePosition(hitNode, nodes);
        finalPosition = {
          dx: dragCurrentPinFlow.x - nodeAbsolute.x,
          dy: dragCurrentPinFlow.y - nodeAbsolute.y,
        };
      } else {
        targetType = 'canvas';
        targetId = '';
        finalPosition = {
          x: dragCurrentPinFlow.x,
          y: dragCurrentPinFlow.y,
        };
      }

      setLocalPositions((prev) => ({
        ...prev,
        [draggedId]: { x: dragCurrentPinFlow.x, y: dragCurrentPinFlow.y },
      }));
      void comments.updatePosition(
        draggedId,
        finalPosition,
        targetType,
        targetId,
      );
    } else {
      comments.openThread(draggedId);
    }

    setDraggedId(null);
    setDragStartMouse(null);
    setDragStartPinFlow(null);
    setDragCurrentPinFlow(null);
    setHasDragged(false);
  };

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden"
    >
      {/* Click-capture layer while comment mode is active. */}
      {commentMode && (
        <div
          className="pointer-events-auto absolute inset-0"
          style={{ cursor: COMMENT_CURSOR }}
          onClick={(event) => {
            comments.startDraftAtScreenPosition(event.clientX, event.clientY);
          }}
        />
      )}

      {/* Flow-space pin layer mirroring the canvas viewport transform. */}
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
          transformOrigin: '0 0',
        }}
      >
        {/* Drop zone highlight for nodes when dragging a comment pin */}
        {hoveredNode &&
          (() => {
            const absPos = getNodeAbsolutePosition(hoveredNode, nodes);
            const { width, height } = getNodeDimensions(hoveredNode);
            return (
              <div
                className="pointer-events-none absolute rounded-lg border-2 border-dashed border-primary bg-primary/5 transition-all duration-150"
                style={{
                  left: absPos.x - 4,
                  top: absPos.y - 4,
                  width: width + 8,
                  height: height + 8,
                  zIndex: 0,
                }}
              />
            );
          })()}

        {shouldCluster
          ? clusters.map((cluster) =>
              cluster.placements.length === 1 ? (
                (() => {
                  const placement = cluster.placements[0];
                  const isDragging = placement.annotation.id === draggedId;
                  const x =
                    isDragging && dragCurrentPinFlow
                      ? dragCurrentPinFlow.x
                      : cluster.x;
                  const y =
                    isDragging && dragCurrentPinFlow
                      ? dragCurrentPinFlow.y
                      : cluster.y;

                  return (
                    <div
                      key={cluster.key}
                      className="absolute"
                      style={{ left: x, top: y }}
                      onPointerDown={(event) =>
                        handlePointerDown(
                          event,
                          placement.annotation.id,
                          cluster.x,
                          cluster.y,
                        )
                      }
                      onPointerMove={handlePointerMove}
                      onPointerUp={(event) => handlePointerUp(event)}
                    >
                      <CommentPin
                        annotation={placement.annotation}
                        isActive={
                          placement.annotation.id ===
                          comments.activeAnnotation?.id
                        }
                        zoom={viewport.zoom}
                        onClick={() => {}}
                      />
                    </div>
                  );
                })()
              ) : (
                <div
                  key={cluster.key}
                  className="absolute"
                  style={{ left: cluster.x, top: cluster.y }}
                >
                  <CommentClusterPin
                    count={cluster.placements.length}
                    zoom={viewport.zoom}
                    onClick={() =>
                      comments.jumpToAnnotation(
                        cluster.placements[0].annotation.id,
                      )
                    }
                  />
                </div>
              ),
            )
          : placements.map((placement) => {
              const isDragging = placement.annotation.id === draggedId;
              const x =
                isDragging && dragCurrentPinFlow
                  ? dragCurrentPinFlow.x
                  : placement.x;
              const y =
                isDragging && dragCurrentPinFlow
                  ? dragCurrentPinFlow.y
                  : placement.y;

              return (
                <div
                  key={placement.annotation.id}
                  className="absolute"
                  style={{ left: x, top: y }}
                  onPointerDown={(event) =>
                    handlePointerDown(
                      event,
                      placement.annotation.id,
                      placement.x,
                      placement.y,
                    )
                  }
                  onPointerMove={handlePointerMove}
                  onPointerUp={(event) => handlePointerUp(event)}
                >
                  <CommentPin
                    annotation={placement.annotation}
                    isActive={
                      placement.annotation.id === comments.activeAnnotation?.id
                    }
                    zoom={viewport.zoom}
                    onClick={() => {}}
                  />
                </div>
              );
            })}

        {/* Draft marker. */}
        {comments.draft && (
          <div
            className="absolute"
            style={{
              left: comments.draft.flowPosition.x,
              top: comments.draft.flowPosition.y,
            }}
          >
            <div
              className="size-[28px] rounded-full rounded-bl-none border-2 border-dashed border-primary bg-primary/20 shadow-md"
              style={{
                transform: `translate(0, -100%) scale(${1 / viewport.zoom})`,
                transformOrigin: 'bottom left',
              }}
            />
          </div>
        )}
      </div>

      {/* Draft composer (constant screen size, clamped to the container). */}
      {comments.draft && (
        <div
          className="pointer-events-auto absolute w-80"
          style={clampPopover(toScreen(comments.draft.flowPosition))}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="glass animate-scale-in rounded-lg border border-border/80 bg-popover p-2 shadow-lg">
            <CommentComposer
              isSubmitting={comments.isCreating}
              onSubmit={(body) => {
                void comments.submitDraft(body);
              }}
              onCancel={comments.cancelDraft}
            />
          </div>
        </div>
      )}

      {/* Active thread popover; detached threads open centered. */}
      {comments.activeAnnotation && (
        <div
          className="pointer-events-auto absolute"
          style={
            activeFlowPosition
              ? clampPopover(toScreen(activeFlowPosition))
              : {
                  left: Math.max(
                    (containerSize.width - POPOVER_WIDTH_PX) / 2,
                    POPOVER_MARGIN_PX,
                  ),
                  top: Math.max(
                    (containerSize.height - POPOVER_MAX_HEIGHT_PX) / 2,
                    POPOVER_MARGIN_PX,
                  ),
                }
          }
        >
          <CommentThreadPopover
            annotation={comments.activeAnnotation}
            currentUserId={comments.currentUserId}
            isSubmitting={comments.isReplying}
            onClose={comments.closeThread}
            onReply={comments.reply}
            onResolve={() => comments.resolve(comments.activeAnnotation!.id)}
            onReopen={() => comments.reopen(comments.activeAnnotation!.id)}
            onDeleteAnnotation={comments.deleteActiveAnnotation}
            onEditComment={comments.editComment}
            onDeleteComment={comments.deleteComment}
            onToggleReaction={comments.toggleReaction}
          />
        </div>
      )}
    </div>
  );
}
