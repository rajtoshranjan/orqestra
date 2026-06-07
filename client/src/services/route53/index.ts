import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { Route53Config } from './types';
import { createDefaultRoute53Config, getRoute53DisplayName } from './defaults';
import { validateRoute53Config } from './validate';
import { Route53Node } from './route53-node';
import { Route53Inspector } from './route53-inspector';
import { Route53Icon } from '@/components/aws-icons';

export const route53Service: ServiceDefinition<Route53Config> = {
  id: 'route53',
  cloudFormationType: 'AWS::Route53::HostedZone',
  name: 'Amazon Route 53',
  shortName: 'Route 53',
  category: 'networking',
  description:
    'Scalable DNS web service that routes users to applications globally by translating domain names to IP addresses.',
  icon: Route53Icon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['dns-service'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: ['alb', 'api-gateway', 'ec2', 'cloudfront'],

  createDefaultConfig: createDefaultRoute53Config,
  validate: validateRoute53Config,
  getDisplayName: getRoute53DisplayName,

  NodeComponent: Route53Node,
  InspectorComponent: Route53Inspector,

  aiHints: {
    summary: 'Scalable DNS web service that routes users to applications globally.',
    role: 'Translates domain names to IP addresses and routes traffic to AWS resources.',
    useCases: [
      'Domain hosting',
      'Health-check-based failover',
      'Latency-based routing',
      'Private DNS for VPCs',
    ],
    keyAttributes: ['hostedZoneName', 'zoneType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: Route53Config,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Route53::HostedZone',
      name: getRoute53DisplayName(config),
      connectionCount,
      details: [{ label: 'Type', value: config.zoneType }],
    };
  },
};

export default route53Service;
