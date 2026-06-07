import type { ServiceValidationErrors } from '../types';
import type { VPCConfig } from './types';
import { vpcConfigSchema } from '@/schemas/resources.schema';

export function validateVPCConfig(config: VPCConfig): ServiceValidationErrors {
  const result = vpcConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
