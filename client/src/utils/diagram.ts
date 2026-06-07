import { validateNodeArchitectureRules } from './validation-engine';
import type {
  DiagramNode,
  DiagramEdge,
  PersistedDiagram,
  DeploymentSettings,
  ServiceValidationErrors,
} from '@/types';
import { registry } from '@/services';

export const DEFAULT_DEPLOYMENT_SETTINGS: DeploymentSettings = {
  region: 'us-east-1',
  executionRoleArn: '',
};

export function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

export function createServiceNode(
  serviceId: string,
  position: { x: number; y: number },
  index: number,
): DiagramNode {
  const service = registry.get(serviceId);
  const config: Record<string, unknown> = service.createDefaultConfig(index);
  const validationErrors = service.validate(config);

  return {
    id: makeId(),
    type: `${serviceId}Node`,
    position,
    data: {
      serviceId,
      label: service.getDisplayName(config),
      config,
      validationErrors,
    },
  };
}

export function withValidatedData(
  node: DiagramNode,
  nodes: DiagramNode[] = [],
  edges: DiagramEdge[] = [],
): DiagramNode {
  const service = registry.find(node.data.serviceId);
  if (!service) return node;

  let validationErrors = service.validate(node.data.config, nodes, edges);
  const structuralErrors = validateNodeArchitectureRules(node, nodes, edges);
  validationErrors = { ...validationErrors, ...structuralErrors };

  return {
    ...node,
    data: {
      ...node.data,
      label: service.getDisplayName(node.data.config),
      validationErrors,
    },
  };
}

export function hasValidationErrors(errors: ServiceValidationErrors) {
  return Object.values(errors).some(Boolean);
}

export function countNodeErrors(node: DiagramNode) {
  return Object.values(node.data.validationErrors).filter(Boolean).length;
}

export function createProjectName(index = 1) {
  return `Cloud Project ${index}`;
}

export function createInitialDiagram(): PersistedDiagram {
  return {
    projectId: makeId(),
    projectName: createProjectName(1),
    projectDescription: 'Visual architecture project',
    nodes: [],
    edges: [],
    deploymentSettings: DEFAULT_DEPLOYMENT_SETTINGS,
    lastSavedAt: null,
  };
}

export function cloneSelection(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): { nodes: DiagramNode[]; edges: DiagramEdge[] } | null {
  const selectedNodes = nodes.filter((n) => n.selected);
  if (selectedNodes.length === 0) return null;

  const selectedIds = new Set(selectedNodes.map((n) => n.id));
  const selectedEdges = edges.filter(
    (e) => selectedIds.has(e.source) && selectedIds.has(e.target),
  );

  return { nodes: selectedNodes, edges: selectedEdges };
}

export function pasteSelection(
  selection: { nodes: DiagramNode[]; edges: DiagramEdge[] },
  setNodes: React.Dispatch<React.SetStateAction<DiagramNode[]>>,
  setEdges: React.Dispatch<React.SetStateAction<DiagramEdge[]>>,
) {
  const idMap = new Map<string, string>();

  const nextNodes = selection.nodes.map((node) => {
    const id = makeId();
    idMap.set(node.id, id);
    return withValidatedData({
      ...node,
      id,
      position: { x: node.position.x + 48, y: node.position.y + 48 },
      selected: true,
    });
  });

  const nextEdges = selection.edges.map((edge) => ({
    ...edge,
    id: makeId(),
    source: idMap.get(edge.source) ?? edge.source,
    target: idMap.get(edge.target) ?? edge.target,
    selected: true,
  }));

  setNodes((current) => [
    ...current.map((n) => ({ ...n, selected: false })),
    ...nextNodes,
  ]);
  setEdges((current) => [
    ...current.map((e) => ({ ...e, selected: false })),
    ...nextEdges,
  ]);
}

export function isInputElement(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    Boolean(target.closest("[contenteditable='true']"))
  );
}

export function getNodeAbsolutePosition(
  node: any,
  nodes: any[],
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  let current = node;
  while (current.parentNode) {
    const parent = nodes.find((n) => n.id === current.parentNode);
    if (!parent) break;
    x += parent.position.x;
    y += parent.position.y;
    current = parent;
  }
  return { x, y };
}

export function getNodeDimensions(node: any): {
  width: number;
  height: number;
} {
  const width =
    node.width ??
    node.style?.width ??
    (node.data?.serviceId === 'vpc' || node.isContainer ? 360 : 200);
  const height =
    node.height ??
    node.style?.height ??
    (node.data?.serviceId === 'vpc' || node.isContainer ? 240 : 100);
  return {
    width: typeof width === 'number' ? width : parseInt(String(width)) || 200,
    height:
      typeof height === 'number' ? height : parseInt(String(height)) || 100,
  };
}

export function getDescendants(parentId: string, nodes: any[]): string[] {
  const children = nodes.filter((n) => n.parentNode === parentId);
  let descendants = children.map((c) => c.id);
  for (const child of children) {
    descendants = [...descendants, ...getDescendants(child.id, nodes)];
  }
  return descendants;
}

export function adjustParentSizes(nodes: any[]): any[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, { ...n }]));
  const childMap = new Map<string, string[]>();

  // Map children
  for (const node of nodes) {
    if (node.parentNode) {
      if (!childMap.has(node.parentNode)) {
        childMap.set(node.parentNode, []);
      }
      childMap.get(node.parentNode)!.push(node.id);
    }
  }

  // Get depth helper
  const getDepth = (nodeId: string): number => {
    let depth = 0;
    let curr = nodeMap.get(nodeId);
    while (curr?.parentNode) {
      depth++;
      curr = nodeMap.get(curr.parentNode);
    }
    return depth;
  };

  // Find all containers and sort by depth descending (deepest first).
  // Uses service.isContainer from the registry — no hardcoded service ID sets.
  const containers = Array.from(nodeMap.values())
    .filter((n) => registry.find(n.data?.serviceId || '')?.isContainer ?? false)
    .map((n) => ({ id: n.id, depth: getDepth(n.id) }))
    .sort((a, b) => b.depth - a.depth);

  const PADDING = 24;

  // Process bottom-up
  for (const containerInfo of containers) {
    const parentNode = nodeMap.get(containerInfo.id)!;
    const childrenIds = childMap.get(parentNode.id) || [];
    if (childrenIds.length === 0) continue;

    let maxRight = 240;
    let maxBottom = 140;

    for (const cid of childrenIds) {
      const child = nodeMap.get(cid)!;
      const dim = getNodeDimensions(child);
      const childRight = child.position.x + dim.width + PADDING;
      const childBottom = child.position.y + dim.height + PADDING;

      maxRight = Math.max(maxRight, childRight);
      maxBottom = Math.max(maxBottom, childBottom);
    }

    const currentW = Number(parentNode.style?.width) || 240;
    const currentH = Number(parentNode.style?.height) || 140;

    parentNode.style = {
      width: Math.max(currentW, maxRight),
      height: Math.max(currentH, maxBottom),
    };
  }

  return Array.from(nodeMap.values());
}

export function findBestParentForPosition(
  position: { x: number; y: number },
  childServiceId: string,
  nodes: any[],
): any | null {
  const childService = registry.find(childServiceId);
  if (!childService) return null;

  const isContainer = registry.find(childServiceId)?.isContainer ?? false;
  const childW = isContainer ? 240 : 200;
  const childH = isContainer ? 140 : 100;

  const center = {
    x: position.x + childW / 2,
    y: position.y + childH / 2,
  };

  let bestParent: any = null;
  for (const n of nodes) {
    const parentService = registry.find(n.data?.serviceId || '');
    if (!parentService || !parentService.isContainer) continue;

    const parentPos = getNodeAbsolutePosition(n, nodes);
    const parentDim = getNodeDimensions(n);

    if (
      center.x >= parentPos.x &&
      center.x <= parentPos.x + parentDim.width &&
      center.y >= parentPos.y &&
      center.y <= parentPos.y + parentDim.height
    ) {
      if (childService.allowedParents?.includes(n.data.serviceId)) {
        if (!bestParent) {
          bestParent = n;
        } else {
          const bestParentPos = getNodeAbsolutePosition(bestParent, nodes);
          const nPos = getNodeAbsolutePosition(n, nodes);
          if (nPos.x > bestParentPos.x || nPos.y > bestParentPos.y) {
            bestParent = n;
          }
        }
      }
    }
  }

  return bestParent;
}
