import { stepFunctionConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { StepFunctionConfig } from './types';

export function validateStepFunctionConfig(
  config: StepFunctionConfig,
): ServiceValidationErrors {
  const result = stepFunctionConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
