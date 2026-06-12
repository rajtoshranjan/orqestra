import { auroraConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { AuroraConfig } from './types';

export function validateAuroraConfig(
  config: AuroraConfig,
): ServiceValidationErrors {
  const result = auroraConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
