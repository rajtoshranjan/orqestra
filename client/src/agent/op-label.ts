import type { AgentOp } from '@/api/agent';
import type { DiagramNode } from '@/types';
import { getDescendants } from '@/utils/diagram';

import type { GraphState } from './op-executor';

/** Icon kinds for agent activity rows (mapped to lucide icons in the panel). */
export type AgentOpIcon =
  | 'add'
  | 'connect'
  | 'configure'
  | 'parent'
  | 'remove'
  | 'check'
  | 'cost'
  | 'info';

export type OpDescription = {
  icon: AgentOpIcon;
  /** Imperative — for a confirmation, before anything has happened. */
  pending: string;
  /** Past tense — for the activity feed, after it has. */
  past: string;
  /** What else this op touches. Empty when it touches nothing but its target. */
  impact: string[];
};

const asString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const plural = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? '' : 's'}`;

function nameOf(nodeId: string, graph?: GraphState): string {
  const node = graph?.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return nodeId;
  return node.data.label || node.data.serviceId || nodeId;
}

/** Nodes and edges a removal takes with it beyond the target itself. */
function removalImpact(targetId: string, graph?: GraphState): string[] {
  if (!graph) return [];
  const isNode = graph.nodes.some((node) => node.id === targetId);
  if (!isNode) return [];

  const removed = new Set<string>([
    targetId,
    ...getDescendants(targetId, graph.nodes as DiagramNode[]),
  ]);
  const severed = graph.edges.filter(
    (edge) => removed.has(edge.source) || removed.has(edge.target),
  ).length;

  const impact: string[] = [];
  if (removed.size > 1) {
    impact.push(plural(removed.size - 1, 'nested resource'));
  }
  if (severed > 0) impact.push(plural(severed, 'connection'));
  return impact;
}

/**
 * Turn a raw agent op into something a human can act on.
 *
 * `pending` is what the confirmation card shows, so it has to name the actual
 * target and say what else goes with it — approving "Removed a resource" is
 * approving nothing in particular. `past` is what the activity feed shows once
 * the op has run. Passing `graph` resolves ids to labels; without it the
 * description still works, just less specifically.
 */
export function describeOp(
  op: Pick<AgentOp, 'name' | 'input'>,
  graph?: GraphState,
): OpDescription {
  const input = op.input ?? {};

  switch (op.name) {
    case 'add_resource': {
      const service = asString(input.service_id) || 'resource';
      const label = asString(input.label);
      const what = label ? `${service} “${label}”` : service;
      const parentId = asString(input.parent_id);
      return {
        icon: 'add',
        pending: `Add ${what}`,
        past: `Added ${what}`,
        impact: parentId ? [`inside ${nameOf(parentId, graph)}`] : [],
      };
    }
    case 'connect': {
      const source = nameOf(asString(input.source_id), graph);
      const target = nameOf(asString(input.target_id), graph);
      const kind = asString(input.relationship_kind);
      const what = `${source} → ${target}`;
      return {
        icon: 'connect',
        pending: `Connect ${what}`,
        past: `Connected ${what}`,
        impact: kind ? [kind] : [],
      };
    }
    case 'configure': {
      const node = nameOf(asString(input.node_id), graph);
      const patch = input.config_patch;
      const fields =
        patch && typeof patch === 'object' ? Object.keys(patch) : [];
      return {
        icon: 'configure',
        pending: `Update ${node}`,
        past: `Updated ${node}`,
        impact: fields.length ? [fields.join(', ')] : [],
      };
    }
    case 'set_parent': {
      const node = nameOf(asString(input.node_id), graph);
      const parentId = asString(input.parent_id);
      if (!parentId) {
        return {
          icon: 'parent',
          pending: `Move ${node} to the top level`,
          past: `Moved ${node} to the top level`,
          impact: [],
        };
      }
      const parent = nameOf(parentId, graph);
      return {
        icon: 'parent',
        pending: `Nest ${node} inside ${parent}`,
        past: `Nested ${node} inside ${parent}`,
        impact: [],
      };
    }
    case 'remove': {
      const targetId = asString(input.target_id);
      const what = nameOf(targetId, graph);
      return {
        icon: 'remove',
        pending: `Remove ${what}`,
        past: `Removed ${what}`,
        impact: removalImpact(targetId, graph),
      };
    }
    case 'validate':
      return {
        icon: 'check',
        pending: 'Validate the architecture',
        past: 'Validated the architecture',
        impact: [],
      };
    case 'estimate_cost':
      return {
        icon: 'cost',
        pending: 'Estimate the monthly cost',
        past: 'Estimated the monthly cost',
        impact: [],
      };
    case 'query_graph':
      return {
        icon: 'info',
        pending: 'Review the canvas',
        past: 'Reviewed the canvas',
        impact: [],
      };
    case 'list_services':
      return {
        icon: 'info',
        pending: 'Browse the service catalog',
        past: 'Browsed the service catalog',
        impact: [],
      };
    case 'get_service': {
      const service = asString(input.service_id) || 'a service';
      return {
        icon: 'info',
        pending: `Inspect ${service}`,
        past: `Inspected ${service}`,
        impact: [],
      };
    }
    default:
      return { icon: 'info', pending: op.name, past: op.name, impact: [] };
  }
}
