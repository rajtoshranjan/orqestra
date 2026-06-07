import type { ServiceValidationErrors } from '../types';
import type { AcmConfig } from './types';
import { acmConfigSchema } from '@/schemas/resources.schema';

export function validateAcmConfig(config: AcmConfig): ServiceValidationErrors {
  const result = acmConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
