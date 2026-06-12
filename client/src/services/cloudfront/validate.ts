import { cloudfrontConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { CloudFrontConfig } from './types';

export function validateCloudFrontConfig(
  config: CloudFrontConfig,
): ServiceValidationErrors {
  const result = cloudfrontConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
