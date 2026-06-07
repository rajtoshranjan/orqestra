import type { ServiceValidationErrors } from '../types';
import type { EnvironmentConfig } from './types';
import { environmentConfigSchema } from '@/schemas/resources.schema';

export function validateEnvironmentConfig(
  config: EnvironmentConfig,
): ServiceValidationErrors {
  const result = environmentConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
