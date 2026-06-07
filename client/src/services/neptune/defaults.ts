import type { NeptuneConfig } from './types';

export function createDefaultNeptuneConfig(index: number): NeptuneConfig {
  return {
    clusterIdentifier: `neptune-cluster-${index}`,
    engineVersion: '1.3.2.0',
    instanceClass: 'db.t3.medium',
  };
}

export function getNeptuneDisplayName(config: NeptuneConfig): string {
  return config.clusterIdentifier.trim() || 'Neptune';
}
