import type { ServiceValidationErrors } from '../types';
import type { EventBridgeConfig } from './types';
import { eventbridgeConfigSchema } from '@/schemas/resources.schema';

export function validateEventBridgeConfig(
  config: EventBridgeConfig,
): ServiceValidationErrors {
  const result = eventbridgeConfigSchema.safeParse(config);
  if (result.success) return {};
  const errors: ServiceValidationErrors = {};
  for (const issue of result.error.issues) {
    errors[issue.path[0] as string] = issue.message;
  }
  return errors;
}
