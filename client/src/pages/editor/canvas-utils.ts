import { registry } from '@/services';
import type { ServiceNodeData, DiagramNode, DiagramEdge } from '@/types';
import {
  countNodeErrors,
  getNodeAbsolutePosition,
  getNodeDimensions,
} from '@/utils';

import type { Node } from 'reactflow';

export const PRO_OPTIONS = { hideAttribution: true };
export const CONTAINER_CHILD_PADDING = 24;
export const CONTAINER_HEADER_HEIGHT = 56;

export type DeploymentNodeStatus = 'not_deployed' | 'deployed' | 'dirty';

export type EnrichedServiceNodeData = ServiceNodeData & {
  deploymentStatus: DeploymentNodeStatus;
  isDragOver: boolean;
  isConnectingActive: boolean;
  isValidTarget: boolean;
  onToggleCollapse: () => void;
};

export type DragParentLookupResult = {
  bestParent: DiagramNode | null;
  absoluteDraggedPosition: { x: number; y: number };
  nodesWithDraggedNode: DiagramNode[];
};

export type CanvasShortcut = {
  key: string;
  meta?: boolean;
  alt?: boolean;
  shift?: boolean;
  description: string;
  category: 'general' | 'canvas' | 'view' | 'edit';
  handler: () => void;
  disabled?: boolean;
};

export const getMiniMapNodeColor = (node: Node<ServiceNodeData>): string => {
  const diagNode: DiagramNode = node;
  return countNodeErrors(diagNode) > 0
    ? 'var(--color-warning)'
    : 'var(--color-accent)';
};

export const getNodesWithDraggedNode = (
  draggedNode: DiagramNode,
  currentNodes: DiagramNode[],
): DiagramNode[] =>
  currentNodes.map((currentNode) => {
    if (currentNode.id !== draggedNode.id) {
      return currentNode;
    }
    return {
      ...currentNode,
      position: draggedNode.position,
      positionAbsolute: draggedNode.positionAbsolute,
      parentNode: draggedNode.parentNode,
      width: draggedNode.width ?? currentNode.width,
      height: draggedNode.height ?? currentNode.height,
      style: draggedNode.style ?? currentNode.style,
    };
  });

export const findBestParentForDraggedNode = (
  draggedNode: DiagramNode,
  currentNodes: DiagramNode[],
): DragParentLookupResult => {
  const nodesWithDraggedNode = getNodesWithDraggedNode(
    draggedNode,
    currentNodes,
  );
  const absoluteDraggedPosition = getNodeAbsolutePosition(
    draggedNode,
    nodesWithDraggedNode,
  );
  const draggedDimensions = getNodeDimensions(draggedNode);
  const center = {
    x: absoluteDraggedPosition.x + draggedDimensions.width / 2,
    y: absoluteDraggedPosition.y + draggedDimensions.height / 2,
  };
  const childService = registry.find(draggedNode.data.serviceId);

  let bestParent: DiagramNode | null = null;

  for (const candidateNode of nodesWithDraggedNode) {
    if (candidateNode.id === draggedNode.id) continue;

    const service = registry.find(candidateNode.data.serviceId);
    if (!service || !service.isContainer) continue;
    if (!childService?.allowedParents?.includes(candidateNode.data.serviceId))
      continue;

    const parentPosition = getNodeAbsolutePosition(
      candidateNode,
      nodesWithDraggedNode,
    );
    const parentDimensions = getNodeDimensions(candidateNode);

    const isWithinParent =
      center.x >= parentPosition.x &&
      center.x <= parentPosition.x + parentDimensions.width &&
      center.y >= parentPosition.y &&
      center.y <= parentPosition.y + parentDimensions.height;

    if (!isWithinParent) continue;

    if (!bestParent) {
      bestParent = candidateNode;
      continue;
    }

    const bestParentPosition = getNodeAbsolutePosition(
      bestParent,
      nodesWithDraggedNode,
    );
    if (
      parentPosition.x > bestParentPosition.x ||
      parentPosition.y > bestParentPosition.y
    ) {
      bestParent = candidateNode;
    }
  }

  return { bestParent, absoluteDraggedPosition, nodesWithDraggedNode };
};

export const isDiagramStructureEqual = (
  nodesA: DiagramNode[],
  nodesB: DiagramNode[],
  edgesA: DiagramEdge[],
  edgesB: DiagramEdge[],
): boolean => {
  if (nodesA.length !== nodesB.length) return false;
  if (edgesA.length !== edgesB.length) return false;

  for (let i = 0; i < nodesA.length; i++) {
    const nA = nodesA[i];
    const nB = nodesB.find((n) => n.id === nA.id);
    if (!nB) return false;
    if (nA.parentNode !== nB.parentNode) return false;
    if (nA.position.x !== nB.position.x || nA.position.y !== nB.position.y)
      return false;
    if (nA.width !== nB.width || nA.height !== nB.height) return false;
    if (JSON.stringify(nA.data.config) !== JSON.stringify(nB.data.config))
      return false;
  }

  for (let i = 0; i < edgesA.length; i++) {
    const eA = edgesA[i];
    const eB = edgesB.find((e) => e.id === eA.id);
    if (!eB) return false;
    if (
      eA.source !== eB.source ||
      eA.target !== eB.target ||
      eA.sourceHandle !== eB.sourceHandle ||
      eA.targetHandle !== eB.targetHandle
    ) {
      return false;
    }
  }

  return true;
};
