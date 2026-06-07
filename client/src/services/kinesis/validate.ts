import type { ServiceValidationErrors } from '../types';
import type { KinesisConfig } from './types';
import { kinesisConfigSchema } from '@/schemas/resources.schema';

export function validateKinesisConfig(
  config: KinesisConfig,
): ServiceValidationErrors {
  const result = kinesisConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
