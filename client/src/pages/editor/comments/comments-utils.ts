import type { ClientAnnotation } from '@/api';
import { registry } from '@/services';
import type { DiagramEdge, DiagramNode } from '@/types';
import { getNodeAbsolutePosition, getNodeDimensions } from '@/utils';

/* Pin positioning */

export type PinPlacement = {
  annotation: ClientAnnotation;
  x: number;
  y: number;
};

export type PinCluster = {
  key: string;
  x: number;
  y: number;
  placements: PinPlacement[];
};

/**
 * Resolves an annotation to flow coordinates, or null when it has no canvas
 * presence (deployment annotations, or node/edge targets that no longer exist).
 */
const getNodeCenter = (
  node: DiagramNode,
  nodes: DiagramNode[],
): { x: number; y: number } => {
  const position = getNodeAbsolutePosition(node, nodes);
  const { width, height } = getNodeDimensions(node);
  return { x: position.x + width / 2, y: position.y + height / 2 };
};

export const resolvePinFlowPosition = (
  annotation: ClientAnnotation,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { x: number; y: number } | null => {
  if (annotation.targetType === 'canvas') {
    const { x, y } = annotation.position;
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    return { x, y };
  }

  if (annotation.targetType === 'node') {
    const node = nodes.find((n) => n.id === annotation.targetId);
    if (!node) return null;
    const absolute = getNodeAbsolutePosition(node, nodes);
    const { width, height } = getNodeDimensions(node);
    const dx = Math.min(Math.max(annotation.position.dx ?? 0, 0), width);
    const dy = Math.min(Math.max(annotation.position.dy ?? 0, 0), height);
    return {
      x: absolute.x + dx,
      y: absolute.y + dy,
    };
  }

  if (annotation.targetType === 'edge') {
    // Pin sits at the midpoint of the endpoint node centers — a good
    // approximation of where a smoothstep edge visually runs.
    const edge = edges.find((e) => e.id === annotation.targetId);
    if (!edge) return null;
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);
    if (!source || !target) return null;
    const sourceCenter = getNodeCenter(source, nodes);
    const targetCenter = getNodeCenter(target, nodes);
    return {
      x: (sourceCenter.x + targetCenter.x) / 2,
      y: (sourceCenter.y + targetCenter.y) / 2,
    };
  }

  return null;
};

export const isAnnotationDetached = (
  annotation: ClientAnnotation,
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): boolean => {
  if (annotation.targetType === 'canvas') return false;
  if (annotation.targetType === 'deployment') return false;
  return resolvePinFlowPosition(annotation, nodes, edges) === null;
};

/**
 * Finds the deepest node containing the flow position, preferring concrete
 * resources over containers so comments attach to what the user aimed at.
 */
export const hitTestNodeAtFlowPosition = (
  flowPosition: { x: number; y: number },
  nodes: DiagramNode[],
): DiagramNode | null => {
  const nodeDepth = (node: DiagramNode): number => {
    let depth = 0;
    let current: DiagramNode | undefined = node;
    while (current?.parentNode) {
      depth += 1;
      current = nodes.find((n) => n.id === current?.parentNode);
    }
    return depth;
  };

  let best: DiagramNode | null = null;
  let bestScore = -1;

  for (const node of nodes) {
    if (node.hidden) continue;
    const position = getNodeAbsolutePosition(node, nodes);
    const { width, height } = getNodeDimensions(node);
    const inside =
      flowPosition.x >= position.x &&
      flowPosition.x <= position.x + width &&
      flowPosition.y >= position.y &&
      flowPosition.y <= position.y + height;
    if (!inside) continue;

    const isContainer =
      registry.find(node.data.serviceId)?.isContainer ?? false;
    // Depth dominates; non-containers win over their container at equal depth.
    const score = nodeDepth(node) * 2 + (isContainer ? 0 : 1);
    if (score > bestScore) {
      best = node;
      bestScore = score;
    }
  }

  return best;
};

/**
 * Finds an edge whose straight-line segment (between endpoint node centers)
 * passes near the flow position. An approximation of the smoothstep path
 * that is plenty accurate for click-to-comment.
 */
export const hitTestEdgeAtFlowPosition = (
  flowPosition: { x: number; y: number },
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  toleranceFlowPx = 24,
): DiagramEdge | null => {
  let best: DiagramEdge | null = null;
  let bestDistance = toleranceFlowPx;

  for (const edge of edges) {
    const source = nodes.find((n) => n.id === edge.source);
    const target = nodes.find((n) => n.id === edge.target);
    if (!source || !target) continue;

    const a = getNodeCenter(source, nodes);
    const b = getNodeCenter(target, nodes);
    const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
    const t =
      lengthSquared === 0
        ? 0
        : Math.max(
            0,
            Math.min(
              1,
              ((flowPosition.x - a.x) * (b.x - a.x) +
                (flowPosition.y - a.y) * (b.y - a.y)) /
                lengthSquared,
            ),
          );
    const closest = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    const distance = Math.hypot(
      flowPosition.x - closest.x,
      flowPosition.y - closest.y,
    );
    if (distance < bestDistance) {
      best = edge;
      bestDistance = distance;
    }
  }

  return best;
};

/* Pin clustering at low zoom */

export const CLUSTER_ZOOM_THRESHOLD = 0.5;
const CLUSTER_SCREEN_DISTANCE_PX = 32;

export const clusterPins = (
  placements: PinPlacement[],
  zoom: number,
): PinCluster[] => {
  const maxFlowDistance = CLUSTER_SCREEN_DISTANCE_PX / zoom;
  const clusters: PinCluster[] = [];

  for (const placement of placements) {
    const cluster = clusters.find(
      (candidate) =>
        Math.hypot(candidate.x - placement.x, candidate.y - placement.y) <=
        maxFlowDistance,
    );
    if (cluster) {
      cluster.placements.push(placement);
    } else {
      clusters.push({
        key: placement.annotation.id,
        x: placement.x,
        y: placement.y,
        placements: [placement],
      });
    }
  }

  return clusters;
};

/* Mention tokens: @[Display Name](user:<uuid>) */

const MENTION_TOKEN_PATTERN = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g;

export const buildMentionToken = (name: string, userId: string): string =>
  `@[${name}](user:${userId})`;

/* Lightweight comment body parsing (markdown subset + mentions) */

export type CommentInlineSegment =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'code'; text: string }
  | { type: 'link'; text: string; href: string }
  | { type: 'mention'; name: string; userId: string };

export type CommentLine = {
  isListItem: boolean;
  segments: CommentInlineSegment[];
};

// Plain `@orqestra` agent tag (not a user token, not inside an email).
const AGENT_MENTION_INLINE = /(?<![\w.@])(@[Oo]rqestra)\b/;

const INLINE_PATTERN = new RegExp(
  [
    MENTION_TOKEN_PATTERN.source,
    /\*\*([^*]+)\*\*/.source,
    /\*([^*]+)\*/.source,
    /`([^`]+)`/.source,
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.source,
    /(https?:\/\/[^\s]+)/.source,
    AGENT_MENTION_INLINE.source,
  ].join('|'),
  'g',
);

const parseInlineSegments = (text: string): CommentInlineSegment[] => {
  const segments: CommentInlineSegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(INLINE_PATTERN)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, index) });
    }

    const [
      ,
      mentionName,
      mentionId,
      bold,
      italic,
      code,
      linkText,
      linkHref,
      bareUrl,
      agentMention,
    ] = match;
    if (mentionName && mentionId) {
      segments.push({ type: 'mention', name: mentionName, userId: mentionId });
    } else if (agentMention) {
      // Render the agent tag like a named mention chip.
      segments.push({ type: 'mention', name: 'Orqestra', userId: 'orqestra' });
    } else if (bold) {
      segments.push({ type: 'bold', text: bold });
    } else if (italic) {
      segments.push({ type: 'italic', text: italic });
    } else if (code) {
      segments.push({ type: 'code', text: code });
    } else if (linkText && linkHref) {
      segments.push({ type: 'link', text: linkText, href: linkHref });
    } else if (bareUrl) {
      segments.push({ type: 'link', text: bareUrl, href: bareUrl });
    }

    lastIndex = index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments;
};

export const parseCommentBody = (body: string): CommentLine[] =>
  body.split('\n').map((line) => {
    const listMatch = /^\s*[-*]\s+(.*)$/.exec(line);
    return {
      isListItem: listMatch !== null,
      segments: parseInlineSegments(listMatch ? listMatch[1] : line),
    };
  });

export { commentBodyToPlainText, getInitials } from '@/utils';
