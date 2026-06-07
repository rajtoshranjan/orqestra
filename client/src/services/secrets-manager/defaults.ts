import type { SecretsManagerConfig } from './types';

export function createDefaultSecretsManagerConfig(
  index: number,
): SecretsManagerConfig {
  return {
    secretName: `secret-${index}`,
    description: '',
    rotationEnabled: false,
  };
}

export function getSecretsManagerDisplayName(
  config: SecretsManagerConfig,
): string {
  return config.secretName.trim() || 'Secret';
}
