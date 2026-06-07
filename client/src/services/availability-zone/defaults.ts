import type { AZConfig } from './types';

export function createDefaultAZConfig(index: number): AZConfig {
  return {
    zoneName:
      index === 1
        ? 'us-east-1a'
        : index === 2
          ? 'us-east-1b'
          : `us-east-1${String.fromCharCode(97 + index - 1)}`,
    isCollapsed: false,
  };
}

export function getAZDisplayName(config: AZConfig): string {
  return config.zoneName.trim() || 'Availability Zone';
}
