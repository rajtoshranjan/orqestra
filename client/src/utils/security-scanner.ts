import { registry } from '../services/registry';
import type { DiagramNode, DiagramEdge } from '@/types';

export type SecurityWarning = {
  id: string;
  severity: 'high' | 'medium' | 'info';
  title: string;
  description: string;
  resourceId?: string;
};

/**
 * Scan architecture graph for security issues.
 *
 * Iterates all nodes and runs each service's declared `securityRules`.
 * Security logic lives in service definitions — not here.
 * Adding security rules for a new service requires only updating that service's definition.
 */
export function scanSecurityRisks(
  nodes: DiagramNode[],
  edges: DiagramEdge[],
): SecurityWarning[] {
  const warnings: SecurityWarning[] = [];

  for (const node of nodes) {
    const service = registry.find(node.data.serviceId);
    if (!service?.securityRules?.length) continue;

    const config = (node.data.config ?? {}) as Record<string, unknown>;
    const nodeName = node.data.label || node.id;

    for (const rule of service.securityRules) {
      if (rule.check(config, node, edges, nodes)) {
        warnings.push({
          id: `${rule.id}-${node.id}`,
          severity: rule.severity,
          title: rule.title,
          description: rule.description(nodeName),
          resourceId: node.id,
        });
      }
    }
  }

  return warnings;
}
