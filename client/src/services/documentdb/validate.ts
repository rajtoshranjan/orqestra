import { documentdbConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { DocumentDbConfig } from './types';

export function validateDocumentDbConfig(
  config: DocumentDbConfig,
): ServiceValidationErrors {
  const result = documentdbConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
