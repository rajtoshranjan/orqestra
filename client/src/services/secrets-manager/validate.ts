import type { ServiceValidationErrors } from '../types';
import type { SecretsManagerConfig } from './types';

export function validateSecretsManagerConfig(
  config: SecretsManagerConfig,
): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};
  if (!config.secretName?.trim()) {
    errors.secretName = 'Secret name is required.';
  }
  return errors;
}
