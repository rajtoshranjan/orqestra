import { registry } from '../services/registry';
import type { DiagramNode, DiagramEdge } from '@/types';

/**
 * Validate architecture rules for a single node.
 *
 * Runs three layers in order:
 *   1. Structural placement — checks `allowedParents` / `forbiddenParents`
 *   2. Relationship constraints — checks `allowedRelationships` / `forbiddenRelationships`
 *   3. Declarative rules — runs `service.validationRules[]` (graph-level, capability-aware)
 *
 * Framework code must remain generic. Service-specific logic belongs in each
 * service definition's `validationRules` array, not here.
 */
export function validateNodeArchitectureRules(
  node: DiagramNode,
  nodes: DiagramNode[] = [],
  edges: DiagramEdge[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const service = registry.find(node.data.serviceId);
  if (!service) return errors;

  /* 1. Placement validation. */
  if (node.parentNode) {
    const parentNode = nodes.find(
      (candidate) => candidate.id === node.parentNode,
    );
    if (parentNode) {
      const parentServiceId = parentNode.data.serviceId;
      const isForbidden =
        service.forbiddenParents?.includes(parentServiceId) ?? false;
      const hasAllowList = (service.allowedParents?.length ?? 0) > 0;
      const isAllowed =
        !hasAllowList ||
        (service.allowedParents?.includes(parentServiceId) ?? false);

      if (isForbidden) {
        errors.placement = `Placement Error: ${service.name} is forbidden inside ${parentNode.data.label}.`;
      } else if (!isAllowed) {
        errors.placement = `Placement Error: ${service.name} cannot be placed inside ${parentNode.data.label}.`;
      }
    }
  }

  /* 2. Relationship validation. */
  const nodeEdges = edges.filter(
    (edge) => edge.source === node.id || edge.target === node.id,
  );

  for (const edge of nodeEdges) {
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const otherNode = nodes.find((candidate) => candidate.id === otherId);
    if (!otherNode) continue;

    const targetServiceId = otherNode.data.serviceId;
    const isForbidden =
      service.forbiddenRelationships?.includes(targetServiceId) ?? false;
    const hasAllowList = (service.allowedRelationships?.length ?? 0) > 0;
    const isAllowed =
      !hasAllowList ||
      (service.allowedRelationships?.includes(targetServiceId) ?? false);

    if (isForbidden || !isAllowed) {
      errors.relationship = `Invalid Connection: ${service.shortName} to ${otherNode.data.label || 'target'} is not allowed at the infrastructure level.`;
    }
  }

  /* 3. Declarative validation rules from the service definition. */
  if (service.validationRules) {
    for (const rule of service.validationRules) {
      if (rule.check({ node, nodes, edges })) {
        errors[rule.id] = rule.message;
      }
    }
  }

  return errors;
}
