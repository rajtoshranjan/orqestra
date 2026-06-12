import { iamRoleConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { IAMRoleConfig } from './types';

export function validateIAMRoleConfig(
  config: IAMRoleConfig,
): ServiceValidationErrors {
  const result = iamRoleConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return errors;
}
