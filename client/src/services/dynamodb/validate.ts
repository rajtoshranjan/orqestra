import type { ServiceValidationErrors } from '../types';
import type { DynamoDBConfig } from './types';
import { dynamodbConfigSchema } from '@/schemas/resources.schema';

export function validateDynamoDBConfig(
  config: DynamoDBConfig,
): ServiceValidationErrors {
  const result = dynamodbConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
