import type { EnvironmentConfig } from './types';

export function createDefaultEnvironmentConfig(
  index: number,
): EnvironmentConfig {
  const envs = ['dev', 'staging', 'prod'];
  return {
    envName: envs[(index - 1) % 3],
    isCollapsed: false,
  };
}

export function getEnvironmentDisplayName(config: EnvironmentConfig): string {
  return config.envName.trim() || 'Environment';
}
