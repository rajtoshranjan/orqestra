import type { ServiceValidationErrors } from '../types';
import type { AmazonMqConfig } from './types';
import { amazonMqConfigSchema } from '@/schemas/resources.schema';

export function validateAmazonMqConfig(
  config: AmazonMqConfig,
): ServiceValidationErrors {
  const result = amazonMqConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
