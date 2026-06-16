import { registry } from '@/services';
import type { DiagramEdge, DiagramEdgeData, DiagramNode } from '@/types';
import {
  adjustParentSizes,
  createServiceNode,
  getDescendants,
  makeId,
  withValidatedData,
} from '@/utils/diagram';

export type GraphState = { nodes: DiagramNode[]; edges: DiagramEdge[] };

export type OpOutcome = {
  state: GraphState;
  content: string;
  isError: boolean;
  mutated: boolean;
};

const COLUMNS = 4;
const GAP_X = 280;
const GAP_Y = 160;

function errorOutcome(state: GraphState, content: string): OpOutcome {
  return { state, content, isError: true, mutated: false };
}

function readOutcome(state: GraphState, content: string): OpOutcome {
  return { state, content, isError: false, mutated: false };
}

function nextTopLevelPosition(state: GraphState): { x: number; y: number } {
  const count = state.nodes.filter((node) => !node.parentNode).length;
  return {
    x: 40 + (count % COLUMNS) * GAP_X,
    y: 40 + Math.floor(count / COLUMNS) * GAP_Y,
  };
}

function summarizeErrors(node: DiagramNode): string {
  const errors = Object.values(node.data.validationErrors).filter(Boolean);
  return errors.length ? ` Validation: ${errors.join('; ')}` : ' Validation: ok.';
}

function addResource(input: Record<string, any>, state: GraphState): OpOutcome {
  const serviceId = String(input.service_id ?? '');
  if (!registry.find(serviceId)) {
    return errorOutcome(state, `Unknown service_id "${serviceId}".`);
  }

  const parentId = input.parent_id != null ? String(input.parent_id) : undefined;
  if (parentId && !state.nodes.some((node) => node.id === parentId)) {
    return errorOutcome(state, `Parent node "${parentId}" not found.`);
  }

  const position = parentId ? { x: 24, y: 56 } : nextTopLevelPosition(state);
  let node = createServiceNode(serviceId, position, state.nodes.length + 1);

  if (input.config && typeof input.config === 'object') {
    node = {
      ...node,
      data: { ...node.data, config: { ...node.data.config, ...(input.config as object) } },
    };
  }
  const explicitLabel = input.label ? String(input.label) : undefined;
  if (parentId) {
    node = { ...node, parentNode: parentId, extent: 'parent' };
  }

  let nodes = [...state.nodes, node];
  let validated = withValidatedData(node, nodes, state.edges);
  // withValidatedData refreshes the label from the config; an explicit label
  // supplied by the agent should win over the derived display name.
  if (explicitLabel) {
    validated = { ...validated, data: { ...validated.data, label: explicitLabel } };
  }
  nodes = nodes.map((current) => (current.id === validated.id ? validated : current));
  nodes = adjustParentSizes(nodes);

  return {
    state: { nodes, edges: state.edges },
    content: `Added ${serviceId} node "${validated.data.label}" (id ${validated.id}).${summarizeErrors(validated)}`,
    isError: false,
    mutated: true,
  };
}

function connect(input: Record<string, any>, state: GraphState): OpOutcome {
  const source = String(input.source_id ?? '');
  const target = String(input.target_id ?? '');
  const kind = input.relationship_kind ? String(input.relationship_kind) : undefined;

  if (!state.nodes.some((n) => n.id === source) || !state.nodes.some((n) => n.id === target)) {
    return errorOutcome(state, 'connect requires existing source_id and target_id.');
  }

  const edge: DiagramEdge = {
    id: makeId(),
    source,
    target,
    data: kind
      ? { relationshipKind: kind as DiagramEdgeData['relationshipKind'] }
      : {},
  };
  const edges = [...state.edges, edge];
  const nodes = state.nodes.map((node) =>
    node.id === source || node.id === target
      ? withValidatedData(node, state.nodes, edges)
      : node,
  );

  return {
    state: { nodes, edges },
    content: `Connected ${source} -> ${target}${kind ? ` (${kind})` : ''}.`,
    isError: false,
    mutated: true,
  };
}

function configure(input: Record<string, any>, state: GraphState): OpOutcome {
  const nodeId = String(input.node_id ?? '');
  const patch =
    input.config_patch && typeof input.config_patch === 'object'
      ? (input.config_patch as Record<string, unknown>)
      : null;
  const target = state.nodes.find((node) => node.id === nodeId);

  if (!target) return errorOutcome(state, `configure: node "${nodeId}" not found.`);
  if (!patch) return errorOutcome(state, 'configure requires a config_patch object.');

  const updated = withValidatedData(
    { ...target, data: { ...target.data, config: { ...target.data.config, ...patch } } },
    state.nodes,
    state.edges,
  );
  const nodes = state.nodes.map((node) => (node.id === nodeId ? updated : node));

  return {
    state: { nodes, edges: state.edges },
    content: `Configured ${nodeId}.${summarizeErrors(updated)}`,
    isError: false,
    mutated: true,
  };
}

function setParent(input: Record<string, any>, state: GraphState): OpOutcome {
  const nodeId = String(input.node_id ?? '');
  const parentId = input.parent_id == null ? null : String(input.parent_id);
  const target = state.nodes.find((node) => node.id === nodeId);

  if (!target) return errorOutcome(state, `set_parent: node "${nodeId}" not found.`);
  if (parentId && !state.nodes.some((node) => node.id === parentId)) {
    return errorOutcome(state, `set_parent: parent "${parentId}" not found.`);
  }

  let updated: DiagramNode;
  if (parentId) {
    updated = { ...target, parentNode: parentId, extent: 'parent' };
  } else {
    const { parentNode: _parent, extent: _extent, ...rest } = target as DiagramNode & {
      parentNode?: string;
      extent?: unknown;
    };
    updated = rest as DiagramNode;
  }
  updated = withValidatedData(updated, state.nodes, state.edges);
  let nodes = state.nodes.map((node) => (node.id === nodeId ? updated : node));
  nodes = adjustParentSizes(nodes);

  return {
    state: { nodes, edges: state.edges },
    content: parentId ? `Moved ${nodeId} into ${parentId}.` : `Moved ${nodeId} to the top level.`,
    isError: false,
    mutated: true,
  };
}

function remove(input: Record<string, any>, state: GraphState): OpOutcome {
  const targetId = String(input.target_id ?? '');
  const isNode = state.nodes.some((node) => node.id === targetId);
  const isEdge = state.edges.some((edge) => edge.id === targetId);

  if (!isNode && !isEdge) {
    return errorOutcome(state, `remove: "${targetId}" is not a node or edge.`);
  }

  if (isEdge) {
    return {
      state: { nodes: state.nodes, edges: state.edges.filter((edge) => edge.id !== targetId) },
      content: `Removed edge ${targetId}.`,
      isError: false,
      mutated: true,
    };
  }

  const removed = new Set<string>([targetId, ...getDescendants(targetId, state.nodes)]);
  const nodes = state.nodes.filter((node) => !removed.has(node.id));
  const edges = state.edges.filter(
    (edge) => !removed.has(edge.source) && !removed.has(edge.target),
  );

  return {
    state: { nodes, edges },
    content: `Removed node ${targetId} and ${removed.size - 1} descendant(s).`,
    isError: false,
    mutated: true,
  };
}

function queryGraph(state: GraphState): OpOutcome {
  const summary = {
    nodes: state.nodes.map((node) => ({
      id: node.id,
      serviceId: node.data.serviceId,
      label: node.data.label,
      parent: node.parentNode ?? null,
    })),
    edges: state.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      relationshipKind: edge.data?.relationshipKind ?? null,
    })),
  };
  return readOutcome(state, JSON.stringify(summary));
}

function validateGraph(state: GraphState): OpOutcome {
  const problems: string[] = [];
  for (const node of state.nodes) {
    const validated = withValidatedData(node, state.nodes, state.edges);
    for (const message of Object.values(validated.data.validationErrors)) {
      if (message) problems.push(`${node.data.label} (${node.id}): ${message}`);
    }
  }
  const content = problems.length
    ? `Validation errors:\n- ${problems.join('\n- ')}`
    : 'Validation passed: no errors.';
  return readOutcome(state, content);
}

function estimateCost(state: GraphState): OpOutcome {
  let total = 0;
  for (const node of state.nodes) {
    const profile = registry.find(node.data.serviceId)?.costProfile;
    if (!profile) continue;
    if (profile.estimate) {
      try {
        total += profile.estimate(node.data.config) || 0;
      } catch {
        /* ignore estimator failures in the summary */
      }
    } else if (profile.baseMonthlyCost) {
      total += profile.baseMonthlyCost;
    }
  }
  return readOutcome(state, `Estimated monthly cost: $${Math.round(total * 100) / 100}.`);
}

function listServices(input: Record<string, any>, state: GraphState): OpOutcome {
  const category = input.category ? String(input.category) : null;
  const lines = registry
    .getAll()
    .filter((service) => !category || service.category === category)
    .map(
      (service) =>
        `${service.id} (${service.category}): ${service.aiHints?.summary ?? service.description}`,
    );
  return readOutcome(state, lines.join('\n'));
}

function getService(input: Record<string, any>, state: GraphState): OpOutcome {
  const serviceId = String(input.service_id ?? '');
  const service = registry.find(serviceId);
  if (!service) return errorOutcome(state, `Unknown service_id "${serviceId}".`);

  return readOutcome(
    state,
    JSON.stringify({
      id: service.id,
      name: service.name,
      category: service.category,
      capabilities: service.capabilities,
      allowedParents: service.allowedParents,
      allowedRelationships: service.allowedRelationships,
      isContainer: service.isContainer ?? false,
      aiHints: service.aiHints,
    }),
  );
}

export function executeOp(
  opName: string,
  input: Record<string, any>,
  state: GraphState,
): OpOutcome {
  switch (opName) {
    case 'add_resource':
      return addResource(input, state);
    case 'connect':
      return connect(input, state);
    case 'configure':
      return configure(input, state);
    case 'set_parent':
      return setParent(input, state);
    case 'remove':
      return remove(input, state);
    case 'query_graph':
      return queryGraph(state);
    case 'validate':
      return validateGraph(state);
    case 'estimate_cost':
      return estimateCost(state);
    case 'list_services':
      return listServices(input, state);
    case 'get_service':
      return getService(input, state);
    default:
      return errorOutcome(state, `Unknown operation: ${opName}`);
  }
}
