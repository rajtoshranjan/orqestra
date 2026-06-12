import { securityGroupConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { SecurityGroupConfig } from './types';

export function validateSecurityGroupConfig(
  config: SecurityGroupConfig,
): ServiceValidationErrors {
  const result = securityGroupConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    if (issue.path.length > 0) {
      errors[issue.path.join('.')] = issue.message;
    }
  }
  return errors;
}
