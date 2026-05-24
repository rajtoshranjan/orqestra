import type {
  DiagramNode,
  DiagramEdge,
  PersistedDiagram,
  DeploymentSettings,
  PlanSummary,
  DeploymentLogEntry,
  SavedProjectRecord,
  ServiceValidationErrors,
} from '@/types';
import { registry } from '@/services';
import { EnvVariables } from '@/config';

/* ─── Constants ───────────────────────────────────────────────────────── */

export const STORAGE_KEY = 'orqestra.projects.v1';
export const NODE_DRAG_TYPE = 'application/orqestra.node';
export const GRID: [number, number] = [24, 24];
export const API_BASE_URL = EnvVariables.apiUrl;

export const DEFAULT_DEPLOYMENT_SETTINGS: DeploymentSettings = {
  region: 'us-east-1',
  executionRoleArn: '',
};

/* ─── ID / Helpers ────────────────────────────────────────────────────── */

export function makeId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

/* ─── Generic Node Factory (registry-driven) ──────────────────────────── */

/**
 * Create a new diagram node for any registered service.
 * Queries the registry for the service definition to get defaults and validation.
 */
export function createServiceNode(
  serviceId: string,
  position: { x: number; y: number },
  index: number,
): DiagramNode {
  const service = registry.get(serviceId);
  const config = service.createDefaultConfig(index);
  const validationErrors = service.validate(config);

  return {
    id: makeId(),
    type: `${serviceId}Node`,
    position,
    data: {
      serviceId,
      label: service.getDisplayName(config),
      config: config as Record<string, unknown>,
      validationErrors,
    },
  };
}

/**
 * Validate a node using its service's validator and update the label.
 * Generic — works for any service type.
 */
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

/**
 * Check if a validation errors object has any errors.
 */
export function hasValidationErrors(errors: ServiceValidationErrors) {
  return Object.values(errors).some(Boolean);
}

/**
 * Count the number of validation errors on a node.
 */
export function countNodeErrors(node: DiagramNode) {
  return Object.values(node.data.validationErrors).filter(Boolean).length;
}

/* ─── Project Name ────────────────────────────────────────────────────── */

export function createProjectName(index = 1) {
  return `Cloud Project ${index}`;
}

/* ─── Initial Diagram ─────────────────────────────────────────────────── */

export function createInitialDiagram(): PersistedDiagram {
  return {
    projectId: makeId(),
    projectName: createProjectName(1),
    projectDescription: 'Visual architecture project',
    nodes: [createServiceNode('lambda', { x: 120, y: 140 }, 1)],
    edges: [],
    deploymentSettings: DEFAULT_DEPLOYMENT_SETTINGS,
    lastSavedAt: null,
  };
}

/* ─── Plan (registry-driven) ──────────────────────────────────────────── */

export function buildPlan(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): PlanSummary {
  const resources = nodes.map((node) => {
    const service = registry.find(node.data.serviceId);
    const connectedEdges = edges.filter(
      (edge) => edge.source === node.id || edge.target === node.id,
    );

    if (service) {
      return service.buildPlanResource(
        node.id,
        node.data.config,
        connectedEdges.length,
      );
    }

    // Fallback for unknown services
    return {
      id: node.id,
      cloudFormationType: 'Unknown',
      name: node.data.label,
      connectionCount: connectedEdges.length,
      details: [],
    };
  });

  return { resourceCount: resources.length, resources };
}

/* ─── Serialization / Persistence ─────────────────────────────────────── */

export function normalizePersistedDiagram(
  parsed: Partial<PersistedDiagram>,
): PersistedDiagram {
  return {
    projectId: parsed.projectId ?? makeId(),
    projectName: parsed.projectName?.trim() || createProjectName(1),
    projectDescription:
      parsed.projectDescription ?? 'Visual architecture project',
    nodes: (parsed.nodes ?? []).map((node) =>
      withValidatedData({ ...node, selected: false }),
    ),
    edges: parsed.edges ?? [],
    deploymentSettings:
      parsed.deploymentSettings ?? DEFAULT_DEPLOYMENT_SETTINGS,
    lastSavedAt: parsed.lastSavedAt ?? null,
  };
}

export function serializeDiagram(diagram: PersistedDiagram): PersistedDiagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => ({
      ...withValidatedData(node),
      selected: false,
      dragging: false,
    })),
    edges: diagram.edges.map((edge) => ({ ...edge, selected: false })),
  };
}

/* ─── LocalStorage ────────────────────────────────────────────────────── */

export function readProjectCollection(): SavedProjectRecord[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SavedProjectRecord[];
    return parsed.map((project) => ({
      ...normalizePersistedDiagram(project),
      updatedAt:
        project.updatedAt ?? project.lastSavedAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

export function readPersistedDiagram(): PersistedDiagram {
  const projects = readProjectCollection();
  if (projects.length === 0) return createInitialDiagram();

  const [latestProject] = [...projects].sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
  return normalizePersistedDiagram(latestProject);
}

export function readProjectById(projectId: string): PersistedDiagram | null {
  const projects = readProjectCollection();
  const found = projects.find((p) => p.projectId === projectId);
  return found ? normalizePersistedDiagram(found) : null;
}

/* ─── Clipboard ───────────────────────────────────────────────────────── */

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

/* ─── Formatting ──────────────────────────────────────────────────────── */

export function formatTimestamp(value: string | null) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatRelativeTime(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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

/* ─── Deployment Log ──────────────────────────────────────────────────── */

export function createLog(
  level: DeploymentLogEntry['level'],
  message: string,
): DeploymentLogEntry {
  return { id: makeId(), level, message };
}
