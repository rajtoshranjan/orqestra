import type { ServiceValidationErrors } from '../types';
import type { BatchConfig } from './types';
import { batchConfigSchema } from '@/schemas/resources.schema';

export function validateBatchConfig(config: BatchConfig): ServiceValidationErrors {
  const result = batchConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
