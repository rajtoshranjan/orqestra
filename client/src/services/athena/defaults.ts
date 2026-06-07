import type { AthenaConfig } from './types';

export function createDefaultAthenaConfig(index: number): AthenaConfig {
  return {
    workGroupName: `athena-workgroup-${index}`,
    outputLocation: `s3://query-results-${index}/`,
    engineVersion: 'AUTO',
  };
}

export function getAthenaDisplayName(config: AthenaConfig): string {
  return config.workGroupName.trim() || 'Amazon Athena';
}
