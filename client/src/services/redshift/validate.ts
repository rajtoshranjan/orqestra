import { redshiftConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { RedshiftConfig } from './types';

export function validateRedshiftConfig(
  config: RedshiftConfig,
): ServiceValidationErrors {
  const result = redshiftConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
