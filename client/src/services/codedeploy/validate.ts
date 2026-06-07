import type { ServiceValidationErrors } from '../types';
import type { CodeDeployConfig } from './types';
import { codedeployConfigSchema } from '@/schemas/resources.schema';

export function validateCodeDeployConfig(
  config: CodeDeployConfig,
): ServiceValidationErrors {
  const result = codedeployConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
