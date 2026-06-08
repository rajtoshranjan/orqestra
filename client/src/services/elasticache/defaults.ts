import type { ElastiCacheConfig } from './types';

export function createDefaultElastiCacheConfig(
  index: number,
): ElastiCacheConfig {
  return {
    clusterName: `cache-cluster-${index}`,
    engine: 'redis',
    cacheNodeType: 'cache.t3.micro',
    numCacheNodes: 1,
  };
}

export function getElastiCacheDisplayName(config: ElastiCacheConfig): string {
  return config.clusterName.trim() || 'ElastiCache Cluster';
}
