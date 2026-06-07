import type { ServiceValidationErrors } from '../types';
import type { TrustBoundaryConfig } from './types';
import { trustBoundaryConfigSchema } from '@/schemas/resources.schema';

export function validateTrustBoundaryConfig(
  config: TrustBoundaryConfig,
): ServiceValidationErrors {
  const result = trustBoundaryConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
