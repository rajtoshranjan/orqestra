import {
  makeId,
  createProjectName,
  withValidatedData,
  createInitialDiagram,
  DEFAULT_DEPLOYMENT_SETTINGS,
} from './diagram';
import type {
  DiagramNode,
  DiagramEdge,
  PersistedDiagram,
  PlanSummary,
  PlanResourceAction,
  ServicePlanResource,
  DeploymentLogEntry,
  SavedProjectRecord,
} from '@/types';
import { registry } from '@/services';

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

/**
 * Enrich a plan summary with deployment diff actions by comparing current
 * canvas nodes against the last successfully deployed graph snapshot.
 *
 * Each resource gets an `action` field:
 * - `create`    — node exists on canvas but was not deployed.
 * - `update`    — node exists on canvas and was deployed, but config changed.
 * - `no_change` — node exists on canvas and matches the deployed config.
 * - `destroy`   — node was deployed but no longer exists on canvas.
 */
export function enrichPlanWithDeploymentDiff(
  planSummary: PlanSummary,
  deployedNodes: DiagramNode[] | null | undefined,
  currentNodes: DiagramNode[],
): PlanSummary & {
  resources: (ServicePlanResource & { action: PlanResourceAction })[];
} {
  if (!deployedNodes || deployedNodes.length === 0) {
    return {
      ...planSummary,
      resources: planSummary.resources.map((resource) => ({
        ...resource,
        action: 'create' as const,
      })),
    };
  }

  const deployedNodeMap = new Map(deployedNodes.map((node) => [node.id, node]));
  const currentNodeMap = new Map(currentNodes.map((node) => [node.id, node]));
  const currentNodeIds = new Set(currentNodes.map((node) => node.id));

  type EnrichedResource = ServicePlanResource & { action: PlanResourceAction };

  const enrichedResources: EnrichedResource[] = planSummary.resources.map(
    (resource) => {
      const currentNode = currentNodeMap.get(resource.id);

      if (!currentNode) {
        return { ...resource, action: 'create' as const };
      }

      // Check if status is already pre-computed on node data, else compute it.
      let deploymentStatus = (currentNode.data as any)?.deploymentStatus;
      if (!deploymentStatus) {
        const deployedNode = deployedNodeMap.get(resource.id);
        if (deployedNode) {
          const currentConfig = JSON.stringify(currentNode.data?.config ?? {});
          const deployedConfig = JSON.stringify(
            deployedNode.data?.config ?? {},
          );
          deploymentStatus =
            currentConfig === deployedConfig ? 'deployed' : 'dirty';
        } else {
          deploymentStatus = 'not_deployed';
        }
      }

      if (deploymentStatus === 'deployed') {
        return { ...resource, action: 'no_change' as const };
      } else if (deploymentStatus === 'dirty') {
        return { ...resource, action: 'update' as const };
      }

      return { ...resource, action: 'create' as const };
    },
  );

  // Append destroy entries for deployed nodes no longer on the canvas.
  for (const [nodeId, deployedNode] of deployedNodeMap) {
    if (currentNodeIds.has(nodeId)) continue;

    const service = registry.find(deployedNode.data?.serviceId ?? '');
    const destroyResource: ServicePlanResource & {
      action: PlanResourceAction;
    } = {
      id: nodeId,
      cloudFormationType: service?.cloudFormationType ?? 'Unknown',
      name: deployedNode.data?.label ?? 'Deleted Resource',
      connectionCount: 0,
      details: [{ label: 'Action', value: 'Will be destroyed' }],
      action: 'destroy',
    };
    enrichedResources.push(destroyResource);
  }

  return {
    resourceCount: enrichedResources.length,
    resources: enrichedResources,
  };
}

export function normalizePersistedDiagram(
  parsed: Partial<PersistedDiagram>,
): PersistedDiagram {
  const nodes = parsed.nodes ?? [];
  const edges = parsed.edges ?? [];
  return {
    projectId: parsed.projectId ?? makeId(),
    projectName: parsed.projectName?.trim() || createProjectName(1),
    projectDescription:
      parsed.projectDescription ?? 'Visual architecture project',
    awsAccountId: parsed.awsAccountId ?? null,
    nodes: nodes.map((node) =>
      withValidatedData({ ...node, selected: false }, nodes, edges),
    ),
    edges: edges,
    deploymentSettings:
      parsed.deploymentSettings ?? DEFAULT_DEPLOYMENT_SETTINGS,
    lastSavedAt: parsed.lastSavedAt ?? null,
  };
}

export function serializeDiagram(diagram: PersistedDiagram): PersistedDiagram {
  return {
    ...diagram,
    nodes: diagram.nodes.map((node) => ({
      ...withValidatedData(node, diagram.nodes, diagram.edges),
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
    const parsed: SavedProjectRecord[] = JSON.parse(raw);
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
