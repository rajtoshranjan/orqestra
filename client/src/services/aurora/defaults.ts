import type { AuroraConfig } from './types';

export function createDefaultAuroraConfig(index: number): AuroraConfig {
  return {
    clusterIdentifier: `aurora-cluster-${index}`,
    engine: 'aurora-postgresql',
    engineVersion: '15.4',
    serverless: false,
  };
}

export function getAuroraDisplayName(config: AuroraConfig): string {
  return config.clusterIdentifier.trim() || 'Aurora Cluster';
}
