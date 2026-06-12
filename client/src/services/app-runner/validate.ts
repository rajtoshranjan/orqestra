import { appRunnerConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { AppRunnerConfig } from './types';

export function validateAppRunnerConfig(
  config: AppRunnerConfig,
): ServiceValidationErrors {
  const result = appRunnerConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
