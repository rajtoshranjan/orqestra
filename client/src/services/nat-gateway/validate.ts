import { z } from 'zod';
import type { ServiceValidationErrors } from '../types';
import type { NatGatewayConfig } from './types';

const natGatewayConfigSchema = z.object({
  natGatewayName: z.string().min(1, 'NAT Gateway Name is required.'),
  connectivityType: z.enum(['public', 'private']),
});

export function validateNatGatewayConfig(
  config: NatGatewayConfig,
): ServiceValidationErrors {
  const result = natGatewayConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
