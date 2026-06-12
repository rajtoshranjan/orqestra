import { athenaConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { AthenaConfig } from './types';

export function validateAthenaConfig(
  config: AthenaConfig,
): ServiceValidationErrors {
  const result = athenaConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
