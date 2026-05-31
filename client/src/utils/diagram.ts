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

export function withValidatedData(node: DiagramNode): DiagramNode {
  const service = registry.find(node.data.serviceId);
  if (!service) return node;

  const validationErrors = service.validate(node.data.config);
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
