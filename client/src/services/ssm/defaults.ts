import type { SsmConfig } from './types';

export function createDefaultSsmConfig(index: number): SsmConfig {
  return {
    parameterName: `/app/config/value-${index}`,
    parameterType: 'String',
    tier: 'Standard',
  };
}

export function getSsmDisplayName(config: SsmConfig): string {
  return config.parameterName.trim() || 'SSM Parameter';
}
