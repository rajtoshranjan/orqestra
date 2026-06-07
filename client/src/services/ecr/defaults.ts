import type { ECRConfig } from './types';

export function createDefaultECRConfig(index: number): ECRConfig {
  return {
    repositoryName: `ecr-repo-${index}`,
    imageTagMutability: 'MUTABLE',
    scanOnPush: true,
  };
}

export function getECRDisplayName(config: ECRConfig): string {
  return config.repositoryName.trim() || 'ECR Repository';
}
