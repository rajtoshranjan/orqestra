import type { ServiceValidationErrors } from '../types';
import type { LambdaConfig } from './types';
import { lambdaConfigSchema } from '@/schemas/lambda.schema';

export function validateLambdaConfig(
  config: LambdaConfig,
  nodes: any[] = [],
  edges: any[] = [],
): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};

  const result = lambdaConfigSchema.safeParse(config);

  if (!result.success) {
    // Map Zod errors back to ServiceValidationErrors
    for (const issue of result.error.issues) {
      const field = issue.path[0];
      if (field === 'environmentVariables') {
        errors.environmentVariables = issue.message;
      } else if (typeof field === 'string') {
        errors[field] = issue.message;
      }
    }
  }

  // Derive myNode reference in the graph
  const myNode = nodes.find((n) => n.data.config === config);
  if (myNode) {
    // 1. ECR validation bypass (if ECR is connected, we don't require manual imageUri)
    const isEcrConnected = edges.some((e) => {
      const otherId = e.source === myNode.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.serviceId === 'ecr';
    });
    if (isEcrConnected && errors.imageUri) {
      delete errors.imageUri;
    }

    // 2. IAM Role check
    const isRoleConnected = edges.some((e) => {
      const otherId = e.source === myNode.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.serviceId === 'iam-role';
    });
    if (!isRoleConnected) {
      errors.executionRole =
        'AWS Lambda requires an IAM Role connected on the canvas.';
    }

    // 3. EFS network check
    const isEfsConnected = edges.some((e) => {
      const otherId = e.source === myNode.id ? e.target : e.source;
      const otherNode = nodes.find((n) => n.id === otherId);
      return otherNode?.data.serviceId === 'efs';
    });
    if (isEfsConnected) {
      // Check parent-child relationship (nesting inside Subnet container)
      let isSubnetParent = false;
      if (myNode.parentNode) {
        const parentNode = nodes.find((n) => n.id === myNode.parentNode);
        if (parentNode?.data?.serviceId === 'subnet') {
          isSubnetParent = true;
        }
      }

      const hasSubnet =
        isSubnetParent ||
        edges.some((e) => {
          const otherId = e.source === myNode.id ? e.target : e.source;
          const otherNode = nodes.find((n) => n.id === otherId);
          return otherNode?.data.serviceId === 'subnet';
        });
      const hasSg = edges.some((e) => {
        const otherId = e.source === myNode.id ? e.target : e.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        return otherNode?.data.serviceId === 'security-group';
      });
      if (!hasSubnet || !hasSg) {
        errors.network =
          'EFS requires Lambda to be connected to Subnet and Security Group (VPC execution).';
      }
    }
  }

  return errors;
}
