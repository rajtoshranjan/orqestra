import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { EcsClusterConfig } from './types';
import {
  createDefaultEcsClusterConfig,
  getEcsClusterDisplayName,
} from './defaults';
import { validateEcsClusterConfig } from './validate';
import { EcsClusterNode } from './ecs-cluster-node';
import { EcsClusterInspector } from './ecs-cluster-inspector';
import { EcsIcon } from '@/components/aws-icons';

export const ecsClusterService: ServiceDefinition<EcsClusterConfig> = {
  id: 'ecs-cluster',
  cloudFormationType: 'AWS::ECS::Cluster',
  name: 'Amazon ECS',
  shortName: 'ECS',
  category: 'compute',
  description:
    'Fully managed container orchestration service for running Docker containers without managing infrastructure.',
  icon: EcsIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['container-cluster'],
    optional: ['execution-role', 'firewall-config', 'monitoring-service'],
  },
  allowedParents: ['region', 'vpc', 'subnet', 'environment', 'availability-zone'],
  allowedRelationships: [
    'ecr',
    'iam-role',
    'alb',
    'cloudwatch',
    'security-group',
    'secrets-manager',
    'efs',
    'kms',
  ],

  createDefaultConfig: createDefaultEcsClusterConfig,
  validate: validateEcsClusterConfig,
  getDisplayName: getEcsClusterDisplayName,

  NodeComponent: EcsClusterNode,
  InspectorComponent: EcsClusterInspector,

  aiHints: {
    summary:
      'Fully managed container orchestration service for running Docker containers.',
    role: 'Runs and scales containerized applications without managing infrastructure.',
    useCases: [
      'Microservices on containers',
      'Batch container workloads',
      'Long-running containerized services',
    ],
    keyAttributes: ['clusterName', 'launchType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: EcsClusterConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::ECS::Cluster',
      name: getEcsClusterDisplayName(config),
      connectionCount,
      details: [{ label: 'Launch Type', value: config.launchType }],
    };
  },
};

export default ecsClusterService;
