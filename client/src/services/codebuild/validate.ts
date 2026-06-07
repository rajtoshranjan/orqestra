import type { ServiceValidationErrors } from '../types';
import type { CodeBuildConfig } from './types';
import { codebuildConfigSchema } from '@/schemas/resources.schema';

export function validateCodeBuildConfig(
  config: CodeBuildConfig,
): ServiceValidationErrors {
  const result = codebuildConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
