import type { CodeBuildConfig } from './types';

export function createDefaultCodeBuildConfig(index: number): CodeBuildConfig {
  return {
    projectName: `build-project-${index}`,
    buildImage: 'aws/codebuild/standard:7.0',
    computeType: 'BUILD_GENERAL1_SMALL',
  };
}

export function getCodeBuildDisplayName(config: CodeBuildConfig): string {
  return config.projectName.trim() || 'CodeBuild';
}
