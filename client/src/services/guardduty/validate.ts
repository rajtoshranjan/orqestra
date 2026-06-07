import type { ServiceValidationErrors } from '../types';
import type { GuardDutyConfig } from './types';
import { guarddutyConfigSchema } from '@/schemas/resources.schema';

export function validateGuardDutyConfig(
  config: GuardDutyConfig,
): ServiceValidationErrors {
  const result = guarddutyConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
