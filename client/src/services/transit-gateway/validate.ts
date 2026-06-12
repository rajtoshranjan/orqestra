import { transitGatewayConfigSchema } from '@/schemas/resources.schema';

import type { ServiceValidationErrors } from '../types';
import type { TransitGatewayConfig } from './types';

export function validateTransitGatewayConfig(
  config: TransitGatewayConfig,
): ServiceValidationErrors {
  const result = transitGatewayConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
