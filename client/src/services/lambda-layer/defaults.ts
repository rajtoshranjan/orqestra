import type { LambdaLayerConfig } from './types';

export function createDefaultLambdaLayerConfig(
  index: number,
): LambdaLayerConfig {
  return {
    layerName: `layer-${index}`,
    description: 'Shared dependency layer',
    compatibleRuntimes: ['nodejs20.x', 'nodejs22.x'],
    compatibleArchitectures: ['x86_64', 'arm64'],
  };
}

export function getLambdaLayerDisplayName(config: LambdaLayerConfig): string {
  return config.layerName.trim() || 'Lambda Layer';
}
