import type { ServiceValidationErrors } from '../types';
import type { CognitoConfig } from './types';

export function validateCognitoConfig(
  config: CognitoConfig,
): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};
  if (!config.userPoolName?.trim()) {
    errors.userPoolName = 'User pool name is required.';
  }
  return errors;
}
