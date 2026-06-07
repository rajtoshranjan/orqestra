import type { BatchConfig } from './types';

export function createDefaultBatchConfig(index: number): BatchConfig {
  return {
    computeEnvironmentName: `batch-env-${index}`,
    computeType: 'FARGATE',
  };
}

export function getBatchDisplayName(config: BatchConfig): string {
  return config.computeEnvironmentName.trim() || 'AWS Batch';
}
