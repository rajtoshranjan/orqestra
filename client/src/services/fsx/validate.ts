import type { ServiceValidationErrors } from '../types';
import type { FSxConfig } from './types';
import { fsxConfigSchema } from '@/schemas/resources.schema';

export function validateFSxConfig(config: FSxConfig): ServiceValidationErrors {
  const result = fsxConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
