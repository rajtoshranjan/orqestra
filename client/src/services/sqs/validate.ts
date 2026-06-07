import type { ServiceValidationErrors } from '../types';
import type { SQSConfig } from './types';
import { sqsConfigSchema } from '@/schemas/resources.schema';

export function validateSQSConfig(config: SQSConfig): ServiceValidationErrors {
  const result = sqsConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
