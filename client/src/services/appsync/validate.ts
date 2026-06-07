import type { ServiceValidationErrors } from '../types';
import type { AppSyncConfig } from './types';
import { appsyncConfigSchema } from '@/schemas/resources.schema';

export function validateAppSyncConfig(
  config: AppSyncConfig,
): ServiceValidationErrors {
  const result = appsyncConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
