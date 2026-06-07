import type { ServiceValidationErrors } from '../types';
import type { EFSConfig } from './types';
import { efsConfigSchema } from '@/schemas/resources.schema';

export function validateEFSConfig(config: EFSConfig): ServiceValidationErrors {
  const result = efsConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return errors;
}
