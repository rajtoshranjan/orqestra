import { registry } from '../services/registry';
import type { DiagramNode, DiagramEdge } from '@/types';

// Helper to find ancestor node of a specific service type
function findAncestorByServiceId(
  nodeId: string,
  serviceId: string,
  nodes: DiagramNode[],
): DiagramNode | null {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let current = nodeMap.get(nodeId);
  while (current?.parentNode) {
    const parent = nodeMap.get(current.parentNode);
    if (!parent) break;
    if (parent.data.serviceId === serviceId) {
      return parent;
    }
    current = parent;
  }
  return null;
}

export function validateNodeArchitectureRules(
  node: DiagramNode,
  nodes: DiagramNode[] = [],
  edges: DiagramEdge[] = [],
): Record<string, string> {
  const errors: Record<string, string> = {};
  const service = registry.find(node.data.serviceId);
  if (!service) return errors;

  // 1. Placement Validation
  if (node.parentNode) {
    const parentNode = nodes.find((n) => n.id === node.parentNode);
    if (parentNode) {
      const parentServiceId = parentNode.data.serviceId;
      const isAllowed = service.allowedParents?.includes(parentServiceId);
      const isForbidden = service.forbiddenParents?.includes(parentServiceId);

      if (isForbidden) {
        errors.placement = `Placement Error: ${service.name} is forbidden inside ${parentNode.data.label}.`;
      } else if (
        service.allowedParents &&
        service.allowedParents.length > 0 &&
        !isAllowed
      ) {
        errors.placement = `Placement Error: ${service.name} cannot be placed inside ${parentNode.data.label}.`;
      }
    }
  }

  // Specifically, Subnet must be placed inside VPC container
  if (node.data.serviceId === 'subnet') {
    const hasVpcAncestor = findAncestorByServiceId(node.id, 'vpc', nodes);
    if (!hasVpcAncestor) {
      errors.placement = 'Subnet must be placed inside a VPC container.';
    }
  }

  // Specifically, Security Group must be placed inside VPC container or connected to it
  if (node.data.serviceId === 'security-group') {
    const hasVpcAncestor = findAncestorByServiceId(node.id, 'vpc', nodes);
    const hasVpcConnection = edges.some((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.serviceId === 'vpc';
    });
    if (!hasVpcAncestor && !hasVpcConnection) {
      errors.vpc =
        'Security Group must be placed inside or connected to a VPC.';
    }
  }

  // 2. Relationship Validation
  const nodeEdges = edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );
  for (const edge of nodeEdges) {
    const otherId = edge.source === node.id ? edge.target : edge.source;
    const otherNode = nodes.find((n) => n.id === otherId);
    if (!otherNode) continue;

    const targetServiceId = otherNode.data.serviceId;
    const isForbidden =
      service.forbiddenRelationships?.includes(targetServiceId);
    const isAllowed =
      !service.allowedRelationships ||
      service.allowedRelationships.includes(targetServiceId);

    if (isForbidden || !isAllowed) {
      if (node.data.serviceId === 'lambda' && targetServiceId === 'lambda') {
        errors.relationship =
          'Invalid Relationship: AWS Lambda functions cannot be directly connected at the infrastructure level. Consider: EventBridge, Step Functions, SNS, SQS instead.';
      } else if (
        node.data.serviceId === 'ecr' &&
        targetServiceId === 'dynamodb'
      ) {
        errors.relationship =
          'Amazon ECR cannot be connected directly to DynamoDB.';
      } else if (
        node.data.serviceId === 'subnet' &&
        targetServiceId === 'iam-role'
      ) {
        errors.relationship =
          'Subnet cannot be directly connected to an IAM Role.';
      } else {
        errors.relationship = `Invalid Connection: ${service.shortName} to ${otherNode.data.label || 'target'} is not allowed at the infrastructure level.`;
      }
    }
  }

  // 3. Capability Validation
  // Specifically: Lambda missing ExecutionRole
  if (node.data.serviceId === 'lambda') {
    const hasRole = edges.some((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.serviceId === 'iam-role';
    });
    if (!hasRole) {
      errors.executionRole =
        'AWS Lambda requires an IAM Role connected on the canvas.';
    }

    // Specifically: Lambda configured with EFS but no Subnet (NetworkAttachment) or SG
    const hasEfs = edges.some((e) => {
      const otherId = e.source === node.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.serviceId === 'efs';
    });
    if (hasEfs) {
      const hasSubnet =
        findAncestorByServiceId(node.id, 'subnet', nodes) ||
        edges.some((e) => {
          const otherId = e.source === node.id ? e.target : e.source;
          const otherNode = nodes.find((n) => n.id === otherId);
          return otherNode?.data.serviceId === 'subnet';
        });
      const hasSg = edges.some((e) => {
        const otherId = e.source === node.id ? e.target : e.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        return otherNode?.data.serviceId === 'security-group';
      });
      if (!hasSubnet || !hasSg) {
        errors.network =
          'EFS requires Lambda to be placed in a Subnet and connected to a Security Group (VPC execution).';
      }
    }

    // Specifically: Container Lambda missing ECR
    const packageType = node.data.config.packageType;
    if (packageType === 'Image') {
      const imageUri = node.data.config.imageUri as string | undefined;
      const hasEcr = edges.some((e) => {
        const otherId = e.source === node.id ? e.target : e.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        return otherNode?.data.serviceId === 'ecr';
      });
      if (!imageUri && !hasEcr) {
        errors.imageUri =
          'Container Lambda requires an ECR Repository connection or Image URI.';
      }
    }
  }

  return errors;
}
