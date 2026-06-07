import type { ServiceValidationErrors } from '../types';
import type { SharedServicesConfig } from './types';
import { sharedServicesConfigSchema } from '@/schemas/resources.schema';

export function validateSharedServicesConfig(
  config: SharedServicesConfig,
): ServiceValidationErrors {
  const result = sharedServicesConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
