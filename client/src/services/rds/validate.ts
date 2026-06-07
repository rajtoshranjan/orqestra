import type { ServiceValidationErrors } from '../types';
import type { RDSConfig } from './types';

export function validateRDSConfig(config: RDSConfig): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};
  if (!config.instanceIdentifier?.trim()) {
    errors.instanceIdentifier = 'Instance identifier is required.';
  }
  if (!config.instanceClass?.trim()) {
    errors.instanceClass = 'Instance class is required.';
  }
  if (config.allocatedStorage < 20) {
    errors.allocatedStorage = 'Allocated storage must be at least 20 GB.';
  }
  return errors;
}
