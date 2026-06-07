import type { ServiceValidationErrors } from '../types';
import type { ECRConfig } from './types';
import { ecrConfigSchema } from '@/schemas/resources.schema';

export function validateECRConfig(config: ECRConfig): ServiceValidationErrors {
  const result = ecrConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
