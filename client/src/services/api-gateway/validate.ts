import type { ServiceValidationErrors } from '../types';
import type { APIGatewayConfig } from './types';
import { apiGatewayConfigSchema } from '@/schemas/resources.schema';

export function validateAPIGatewayConfig(
  config: APIGatewayConfig,
): ServiceValidationErrors {
  const result = apiGatewayConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path.join('.')] = issue.message;
  }
  return errors;
}
