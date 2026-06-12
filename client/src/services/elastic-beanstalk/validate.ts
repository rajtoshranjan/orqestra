import { elasticBeanstalkConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { ElasticBeanstalkConfig } from './types';

export function validateElasticBeanstalkConfig(
  config: ElasticBeanstalkConfig,
): ServiceValidationErrors {
  const result = elasticBeanstalkConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
