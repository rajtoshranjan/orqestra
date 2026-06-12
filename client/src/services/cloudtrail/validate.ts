import { cloudtrailConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { CloudTrailConfig } from './types';

export function validateCloudTrailConfig(
  config: CloudTrailConfig,
): ServiceValidationErrors {
  const result = cloudtrailConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
