import { opensearchConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { OpenSearchConfig } from './types';

export function validateOpenSearchConfig(
  config: OpenSearchConfig,
): ServiceValidationErrors {
  const result = opensearchConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
