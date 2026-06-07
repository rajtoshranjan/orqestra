import type { ServiceValidationErrors } from '../types';
import type { EksClusterConfig } from './types';
import { eksClusterConfigSchema } from '@/schemas/resources.schema';

export function validateEksClusterConfig(
  config: EksClusterConfig,
): ServiceValidationErrors {
  const result = eksClusterConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
