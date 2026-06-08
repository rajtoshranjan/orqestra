import type { CodePipelineConfig } from './types';

export function createDefaultCodePipelineConfig(
  index: number,
): CodePipelineConfig {
  return {
    pipelineName: `pipeline-${index}`,
    pipelineType: 'V2',
  };
}

export function getCodePipelineDisplayName(config: CodePipelineConfig): string {
  return config.pipelineName.trim() || 'CodePipeline';
}
