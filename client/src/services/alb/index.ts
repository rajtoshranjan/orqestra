import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { AlbConfig } from './types';
import { createDefaultAlbConfig, getAlbDisplayName } from './defaults';
import { validateAlbConfig } from './validate';
import { AlbNode } from './alb-node';
import { AlbInspector } from './alb-inspector';
import { AlbIcon } from '@/components/aws-icons';

export const albService: ServiceDefinition<AlbConfig> = {
  id: 'alb',
  cloudFormationType: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
  name: 'Load Balancer',
  shortName: 'ALB',
  category: 'networking',
  description:
    'Distributes incoming application traffic across multiple targets for high availability and fault tolerance.',
  icon: AlbIcon,
  accentColor: '#29B0D9',
  isContainer: false,
  capabilities: {
    provides: ['load-balancer'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: ['ec2', 'lambda', 'security-group', 'cloudwatch'],

  createDefaultConfig: createDefaultAlbConfig,
  validate: validateAlbConfig,
  getDisplayName: getAlbDisplayName,

  NodeComponent: AlbNode,
  InspectorComponent: AlbInspector,

  buildPlanResource: (
    nodeId: string,
    config: AlbConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      name: getAlbDisplayName(config),
      connectionCount,
      details: [
        { label: 'Scheme', value: config.scheme },
        { label: 'Type', value: config.lbType },
      ],
    };
  },

  aiHints: {
    summary:
      'Distributes incoming traffic across multiple targets for high availability.',
    role: 'Entry point for user traffic with automatic health-based routing.',
    useCases: [
      'High availability web apps',
      'Microservices routing',
      'Blue-green deployments',
    ],
    keyAttributes: ['loadBalancerName', 'scheme', 'lbType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,
};

export default albService;
