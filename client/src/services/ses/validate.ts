import type { ServiceValidationErrors } from '../types';
import type { SesConfig } from './types';
import { sesConfigSchema } from '@/schemas/resources.schema';

export function validateSesConfig(config: SesConfig): ServiceValidationErrors {
  const result = sesConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
