import type { SageMakerConfig } from './types';

export function createDefaultSageMakerConfig(index: number): SageMakerConfig {
  return {
    notebookName: `sagemaker-notebook-${index}`,
    instanceType: 'ml.t3.medium',
    volumeSizeGb: 20,
  };
}

export function getSageMakerDisplayName(config: SageMakerConfig): string {
  return config.notebookName.trim() || 'SageMaker';
}
