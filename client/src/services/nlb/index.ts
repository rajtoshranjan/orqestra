import { NlbIcon } from '@/components/icons';

import { createDefaultNlbConfig, getNlbDisplayName } from './defaults';
import { NlbInspector } from './nlb-inspector';
import { NlbNode } from './nlb-node';
import { validateNlbConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { NlbConfig } from './types';

export const nlbService: ServiceDefinition<NlbConfig> = {
  id: 'nlb',
  cloudFormationType: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
  name: 'Network Load Balancer',
  shortName: 'NLB',
  category: 'networking',
  description:
    'Layer 4 load balancer for high-performance TCP, UDP, and TLS traffic.',
  icon: NlbIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['network-load-balancer'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: [
    'ec2',
    'ecs-cluster',
    'eks-cluster',
    'subnet',
    'vpc',
    'route53',
    'acm',
    'cloudwatch',
    'security-group',
  ],

  createDefaultConfig: createDefaultNlbConfig,
  validate: validateNlbConfig,
  getDisplayName: getNlbDisplayName,

  NodeComponent: NlbNode,
  InspectorComponent: NlbInspector,

  aiHints: {
    summary: 'Layer 4 network load balancer for TCP, UDP, and TLS traffic.',
    role: 'Distributes transport-level traffic to compute targets.',
    useCases: [
      'High-throughput TCP workloads',
      'Private service entry points',
      'TLS pass-through or termination',
    ],
    keyAttributes: ['loadBalancerName', 'scheme', 'ipAddressType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: NlbConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::ElasticLoadBalancingV2::LoadBalancer',
      name: getNlbDisplayName(config),
      connectionCount,
      details: [
        { label: 'Scheme', value: config.scheme },
        { label: 'IP Type', value: config.ipAddressType },
      ],
    };
  },
};

export default nlbService;
