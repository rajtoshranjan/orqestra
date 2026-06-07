import type { AppRunnerConfig } from './types';

export function createDefaultAppRunnerConfig(index: number): AppRunnerConfig {
  return {
    serviceName: `app-runner-${index}`,
    cpu: '0.5 vCPU',
    memory: '1 GB',
  };
}

export function getAppRunnerDisplayName(config: AppRunnerConfig): string {
  return config.serviceName.trim() || 'App Runner';
}
