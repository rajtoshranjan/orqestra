import type { ServiceValidationErrors } from '../types';
import type { DynamoDBConfig } from './types';
import { dynamodbConfigSchema } from '@/schemas/resources.schema';

export function validateDynamoDBConfig(
  config: DynamoDBConfig,
): ServiceValidationErrors {
  const cleanConfig = { ...config };

  if (!cleanConfig.rangeKey || !cleanConfig.rangeKey.trim()) {
    delete cleanConfig.rangeKey;
    delete cleanConfig.rangeKeyType;
  }

  if (!cleanConfig.streamEnabled) {
    delete cleanConfig.streamViewType;
  }

  const result = dynamodbConfigSchema.safeParse(cleanConfig);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
