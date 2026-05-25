import type {
  DiagramNode,
  DiagramEdge,
  PersistedDiagram,
  PlanSummary,
  DeploymentLogEntry,
  SavedProjectRecord,
} from '@/types';
import { registry } from '@/services';
import {
  makeId,
  createProjectName,
  withValidatedData,
  createInitialDiagram,
  DEFAULT_DEPLOYMENT_SETTINGS,
} from './diagram';

const STORAGE_KEY = 'orqestra.projects.v1';

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

export function createLog(
  level: DeploymentLogEntry['level'],
  message: string,
): DeploymentLogEntry {
  return { id: makeId(), level, message };
}
export { STORAGE_KEY };
