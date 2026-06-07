export type ElastiCacheEngine = 'redis' | 'memcached';

export type ElastiCacheConfig = {
  clusterName: string;
  engine: ElastiCacheEngine;
  cacheNodeType: string;
  numCacheNodes: number;
};
