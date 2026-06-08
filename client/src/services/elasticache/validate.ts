import type { ServiceValidationErrors } from '../types';
import type { ElastiCacheConfig } from './types';
import { elasticacheConfigSchema } from '@/schemas/resources.schema';

export function validateElastiCacheConfig(
  config: ElastiCacheConfig,
): ServiceValidationErrors {
  const result = elasticacheConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
