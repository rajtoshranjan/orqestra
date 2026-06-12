import { appGroupConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { AppGroupConfig } from './types';

export function validateAppGroupConfig(
  config: AppGroupConfig,
): ServiceValidationErrors {
  const result = appGroupConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
