import type { ServiceValidationErrors } from '../types';
import type { LambdaLayerConfig } from './types';
import { lambdaLayerConfigSchema } from '@/schemas/resources.schema';

export function validateLambdaLayerConfig(
  config: LambdaLayerConfig,
): ServiceValidationErrors {
  const result = lambdaLayerConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
