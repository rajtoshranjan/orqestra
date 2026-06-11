import { useEffect, useMemo, useRef, useState } from 'react';
import { useViewport } from 'reactflow';
import { CommentClusterPin, CommentPin } from './comment-pin';
import { CommentComposer } from './comment-composer';
import { CommentThreadPopover } from './comment-thread-popover';
import {
  CLUSTER_ZOOM_THRESHOLD,
  clusterPins,
  resolvePinFlowPosition,
} from './comments-utils';
import type { PinPlacement } from './comments-utils';
import type { CommentsApi } from './use-comments';
import type { DiagramEdge, DiagramNode } from '@/types';

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

  const placements = useMemo<PinPlacement[]>(() => {
    return comments.pinnedAnnotations.flatMap((annotation) => {
      const position = resolvePinFlowPosition(annotation, nodes, edges);
      return position ? [{ annotation, ...position }] : [];
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
        {shouldCluster
          ? clusters.map((cluster) =>
            cluster.placements.length === 1 ? (
              <div
                key={cluster.key}
                className="absolute"
                style={{ left: cluster.x, top: cluster.y }}
              >
                <CommentPin
                  annotation={cluster.placements[0].annotation}
                  isActive={
                    cluster.placements[0].annotation.id ===
                    comments.activeAnnotation?.id
                  }
                  zoom={viewport.zoom}
                  onClick={() =>
                    comments.openThread(cluster.placements[0].annotation.id)
                  }
                />
              </div>
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
          : placements.map((placement) => (
            <div
              key={placement.annotation.id}
              className="absolute"
              style={{ left: placement.x, top: placement.y }}
            >
              <CommentPin
                annotation={placement.annotation}
                isActive={
                  placement.annotation.id === comments.activeAnnotation?.id
                }
                zoom={viewport.zoom}
                onClick={() => comments.openThread(placement.annotation.id)}
              />
            </div>
          ))}

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
