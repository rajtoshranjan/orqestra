import type { ServiceValidationErrors } from '../types';
import type { SubnetConfig } from './types';
import { subnetConfigSchema } from '@/schemas/resources.schema';

export function validateSubnetConfig(
  config: SubnetConfig,
  nodes: any[] = [],
  edges: any[] = [],
): ServiceValidationErrors {
  const result = subnetConfigSchema.safeParse(config);
  const errors: ServiceValidationErrors = {};
  if (!result.success) {
    for (const issue of result.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
  }

  // VPC check
  const myNode = nodes.find((n) => n.data.config === config);
  if (myNode) {
    // Check parent-child relationship (nesting inside VPC container)
    let isVpcParent = false;
    if (myNode.parentNode) {
      const parentNode = nodes.find((n) => n.id === myNode.parentNode);
      if (parentNode?.data?.serviceId === 'vpc') {
        isVpcParent = true;
      }
    }

    // Check edge connection
    const isVpcConnected = edges.some((e) => {
      const otherId = e.source === myNode.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.serviceId === 'vpc';
    });

    if (!isVpcParent && !isVpcConnected) {
      errors.vpc = 'Subnet must be connected to a VPC on the canvas.';
    }
  }

  return errors;
}
