import type { ServiceValidationErrors } from '../types';
import type { VpcEndpointConfig } from './types';
import { vpcEndpointConfigSchema } from '@/schemas/resources.schema';

export function validateVpcEndpointConfig(
  config: VpcEndpointConfig,
): ServiceValidationErrors {
  const result = vpcEndpointConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
