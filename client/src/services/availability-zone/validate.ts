import type { ServiceValidationErrors } from '../types';
import type { AZConfig } from './types';
import { azConfigSchema } from '@/schemas/resources.schema';

export function validateAZConfig(config: AZConfig): ServiceValidationErrors {
  const result = azConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
