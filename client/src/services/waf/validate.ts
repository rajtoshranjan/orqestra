import type { ServiceValidationErrors } from '../types';
import type { WafConfig } from './types';
import { wafConfigSchema } from '@/schemas/resources.schema';

export function validateWafConfig(config: WafConfig): ServiceValidationErrors {
  const result = wafConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
