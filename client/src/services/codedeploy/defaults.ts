import type { CodeDeployConfig } from './types';

export function createDefaultCodeDeployConfig(index: number): CodeDeployConfig {
  return {
    applicationName: `deploy-app-${index}`,
    computePlatform: 'ECS',
  };
}

export function getCodeDeployDisplayName(config: CodeDeployConfig): string {
  return config.applicationName.trim() || 'CodeDeploy';
}
