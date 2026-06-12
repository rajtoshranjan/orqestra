import { neptuneConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { NeptuneConfig } from './types';

export function validateNeptuneConfig(
  config: NeptuneConfig,
): ServiceValidationErrors {
  const result = neptuneConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
