import { ecsClusterConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { EcsClusterConfig } from './types';

export function validateEcsClusterConfig(
  config: EcsClusterConfig,
): ServiceValidationErrors {
  const result = ecsClusterConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
