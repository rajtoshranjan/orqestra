import type { ServiceValidationErrors } from '../types';
import type { XRayConfig } from './types';
import { xrayConfigSchema } from '@/schemas/resources.schema';

export function validateXRayConfig(
  config: XRayConfig,
): ServiceValidationErrors {
  const result = xrayConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
