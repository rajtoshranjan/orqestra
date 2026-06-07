import type { RedshiftConfig } from './types';

export function createDefaultRedshiftConfig(index: number): RedshiftConfig {
  return {
    clusterIdentifier: `redshift-cluster-${index}`,
    nodeType: 'dc2.large',
    numberOfNodes: 2,
    databaseName: 'dev',
  };
}

export function getRedshiftDisplayName(config: RedshiftConfig): string {
  return config.clusterIdentifier.trim() || 'Redshift Cluster';
}
