import { codepipelineConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { CodePipelineConfig } from './types';

export function validateCodePipelineConfig(
  config: CodePipelineConfig,
): ServiceValidationErrors {
  const result = codepipelineConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
