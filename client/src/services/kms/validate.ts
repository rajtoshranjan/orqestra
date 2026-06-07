import type { ServiceValidationErrors } from '../types';
import type { KMSConfig } from './types';

export function validateKMSConfig(config: KMSConfig): ServiceValidationErrors {
  const errors: ServiceValidationErrors = {};
  if (!config.keyAlias?.trim()) {
    errors.keyAlias = 'Key alias is required.';
  } else if (!config.keyAlias.startsWith('alias/')) {
    errors.keyAlias = "Key alias must start with 'alias/'.";
  }
  return errors;
}
