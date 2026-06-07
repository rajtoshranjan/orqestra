import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { ElastiCacheConfig } from './types';
import {
  createDefaultElastiCacheConfig,
  getElastiCacheDisplayName,
} from './defaults';
import { validateElastiCacheConfig } from './validate';
import { ElastiCacheNode } from './elasticache-node';
import { ElastiCacheInspector } from './elasticache-inspector';
import { ElastiCacheIcon } from '@/components/aws-icons';

export const elasticacheService: ServiceDefinition<ElastiCacheConfig> = {
  id: 'elasticache',
  cloudFormationType: 'AWS::ElastiCache::ReplicationGroup',
  name: 'Amazon ElastiCache',
  shortName: 'ElastiCache',
  category: 'database',
  description:
    'Fully managed in-memory caching service for Redis and Memcached workloads.',
  icon: ElastiCacheIcon,
  accentColor: '#C7131F',
  capabilities: {
    provides: ['cache'],
  },
  allowedParents: ['subnet', 'vpc', 'region'],
  allowedRelationships: ['security-group', 'lambda', 'ec2', 'cloudwatch'],

  createDefaultConfig: createDefaultElastiCacheConfig,
  validate: validateElastiCacheConfig,
  getDisplayName: getElastiCacheDisplayName,

  NodeComponent: ElastiCacheNode,
  InspectorComponent: ElastiCacheInspector,

  aiHints: {
    summary: 'In-memory caching service that improves application performance.',
    role: 'Reduces database load by caching frequently-accessed data in memory.',
    useCases: [
      'Session state caching',
      'Database query result caching',
      'Real-time leaderboards',
      'Rate limiting',
    ],
    keyAttributes: ['clusterName', 'engine', 'cacheNodeType', 'numCacheNodes'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: ElastiCacheConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::ElastiCache::ReplicationGroup',
      name: getElastiCacheDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engine },
        { label: 'Nodes', value: String(config.numCacheNodes) },
      ],
    };
  },
};

export default elasticacheService;
