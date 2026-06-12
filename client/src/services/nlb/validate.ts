import { nlbConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { NlbConfig } from './types';

export function validateNlbConfig(config: NlbConfig): ServiceValidationErrors {
  const result = nlbConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
