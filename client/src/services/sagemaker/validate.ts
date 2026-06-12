import { sagemakerConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { SageMakerConfig } from './types';

export function validateSageMakerConfig(
  config: SageMakerConfig,
): ServiceValidationErrors {
  const result = sagemakerConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
