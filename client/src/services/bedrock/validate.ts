import { bedrockConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { BedrockConfig } from './types';

export function validateBedrockConfig(
  config: BedrockConfig,
): ServiceValidationErrors {
  const result = bedrockConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
