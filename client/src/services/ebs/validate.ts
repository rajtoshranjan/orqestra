import type { ServiceValidationErrors } from '../types';
import type { EBSConfig } from './types';
import { ebsConfigSchema } from '@/schemas/resources.schema';

export function validateEBSConfig(config: EBSConfig): ServiceValidationErrors {
  const result = ebsConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
