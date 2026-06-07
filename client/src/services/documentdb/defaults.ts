import type { DocumentDbConfig } from './types';

export function createDefaultDocumentDbConfig(index: number): DocumentDbConfig {
  return {
    clusterIdentifier: `documentdb-cluster-${index}`,
    engineVersion: '5.0.0',
    instanceClass: 'db.t3.medium',
  };
}

export function getDocumentDbDisplayName(config: DocumentDbConfig): string {
  return config.clusterIdentifier.trim() || 'DocumentDB';
}
