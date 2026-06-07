import type { ServiceValidationErrors } from '../types';
import type { AccountConfig } from './types';
import { accountConfigSchema } from '@/schemas/resources.schema';

export function validateAccountConfig(
  config: AccountConfig,
): ServiceValidationErrors {
  const result = accountConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
