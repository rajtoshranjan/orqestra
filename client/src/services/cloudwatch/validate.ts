import type { ServiceValidationErrors } from '../types';
import type { CloudWatchConfig } from './types';

export function validateCloudWatchConfig(
  config: CloudWatchConfig,
): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};
  if (!config.dashboardName?.trim()) {
    errors.dashboardName = 'Dashboard name is required.';
  }
  return errors;
}
