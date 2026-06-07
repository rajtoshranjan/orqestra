import { z } from 'zod';
import type { ServiceValidationErrors } from '../types';
import type { InternetGatewayConfig } from './types';

const internetGatewayConfigSchema = z.object({
  gatewayName: z.string().min(1, 'Gateway Name is required.'),
});

export function validateInternetGatewayConfig(
  config: InternetGatewayConfig,
): ServiceValidationErrors {
  const result = internetGatewayConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
