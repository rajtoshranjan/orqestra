import { GraphEngine } from '@/graph';
import { registry } from '@/services/registry';
import type { DiagramNode, DiagramEdge } from '@/types';

export type GraphContextResource = {
  nodeId: string;
  serviceId: string;
  name: string;
  category: string;
  /** Capabilities this resource provides. */
  provides: string[];
  /** Capabilities this resource requires or optionally uses. */
  requires: string[];
  parentId: string | null;
  childrenIds: string[];
  connectedToIds: string[];
  config: Record<string, unknown>;
  hasErrors: boolean;
  errorCount: number;
  aiHints?: {
    summary: string;
    role: string;
    useCases: string[];
    keyAttributes: string[];
  };
};

export type GraphContextEdge = {
  source: string;
  target: string;
  sourceService: string;
  targetService: string;
  /** Semantic relationship kind, if set on the edge. */
  relationshipKind?: string;
  label?: string;
};

export type GraphContextSummary = {
  totalResources: number;
  byCategory: Record<string, number>;
  hasErrors: boolean;
  errorCount: number;
  deployableCount: number;
};

export type GraphContext = {
  projectId: string;
  projectName: string;
  resources: GraphContextResource[];
  edges: GraphContextEdge[];
  /** Parent ID → list of child IDs. Describes the containment hierarchy. */
  hierarchy: Record<string, string[]>;
  summary: GraphContextSummary;
};

/**
 * Serialize the architecture graph into an AI-consumable representation.
 *
 * Produces a provider-agnostic, structured view of the architecture without
 * any UI implementation details. Used by AI agents to read, reason about,
 * and generate architectures.
 *
 * @example
 * const context = buildGraphContext(nodes, edges, projectId, projectName);
 * // Pass context.resources and context.edges to an AI agent.
 */
export function buildGraphContext(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
  projectId: string,
  projectName: string,
): GraphContext {
  const engine = new GraphEngine(nodes, edges);

  const resources: GraphContextResource[] = nodes.map((node) => {
    const service = registry.find(node.data.serviceId);
    const errors = node.data.validationErrors ?? {};
    const errorCount = Object.values(errors).filter(Boolean).length;

    return {
      nodeId: node.id,
      serviceId: node.data.serviceId,
      name: node.data.label || node.id,
      category: service?.category ?? 'unknown',
      provides: service?.capabilities?.provides ?? [],
      requires: [
        ...(service?.capabilities?.requires ?? []),
        ...(service?.capabilities?.optional ?? []),
      ],
      parentId: node.parentNode ?? null,
      childrenIds: engine.getChildren(node.id).map((child) => child.id),
      connectedToIds: engine
        .getConnectedNodes(node.id)
        .map((connected) => connected.id),
      config: node.data.config ?? {},
      hasErrors: errorCount > 0,
      errorCount,
      aiHints: service?.aiHints,
    };
  });

  const contextEdges: GraphContextEdge[] = edges.map((edge) => {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    const targetNode = nodes.find((node) => node.id === edge.target);
    return {
      source: edge.source,
      target: edge.target,
      sourceService: sourceNode?.data.serviceId ?? 'unknown',
      targetService: targetNode?.data.serviceId ?? 'unknown',
      relationshipKind: edge.data?.relationshipKind,
      label: edge.data?.label,
    };
  });

  const hierarchy: Record<string, string[]> = {};
  for (const node of nodes) {
    if (!node.parentNode) continue;
    if (!hierarchy[node.parentNode]) {
      hierarchy[node.parentNode] = [];
    }
    hierarchy[node.parentNode].push(node.id);
  }

  const byCategory: Record<string, number> = {};
  let errorCount = 0;
  let deployableCount = 0;

  for (const resource of resources) {
    byCategory[resource.category] = (byCategory[resource.category] ?? 0) + 1;
    if (resource.hasErrors) errorCount++;

    const service = registry.find(resource.serviceId);
    const isDeployable =
      service?.deploymentHints?.isDeployable ??
      !service?.deploymentHints?.isLogicalOnly;
    if (isDeployable) deployableCount++;
  }

  return {
    projectId,
    projectName,
    resources,
    edges: contextEdges,
    hierarchy,
    summary: {
      totalResources: nodes.length,
      byCategory,
      hasErrors: errorCount > 0,
      errorCount,
      deployableCount,
    },
  };
}
