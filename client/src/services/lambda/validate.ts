import type { ServiceValidationErrors } from '../types';
import type { LambdaConfig } from './types';
import { lambdaConfigSchema } from '@/schemas/lambda.schema';

export function validateLambdaConfig(
  config: LambdaConfig,
): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};

  const result = lambdaConfigSchema.safeParse(config);

  if (result.success) {
    return errors;
  }

  // Map Zod errors back to ServiceValidationErrors
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if (field === 'environmentVariables') {
      errors.environmentVariables = issue.message;
    } else if (typeof field === 'string') {
      errors[field] = issue.message;
    }
  }

  return errors;
}
