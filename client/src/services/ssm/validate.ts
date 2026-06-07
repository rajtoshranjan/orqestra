import type { ServiceValidationErrors } from '../types';
import type { SsmConfig } from './types';
import { ssmConfigSchema } from '@/schemas/resources.schema';

export function validateSsmConfig(config: SsmConfig): ServiceValidationErrors {
  const result = ssmConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
