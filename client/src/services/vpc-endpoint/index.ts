import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { VpcEndpointConfig } from './types';
import {
  createDefaultVpcEndpointConfig,
  getVpcEndpointDisplayName,
} from './defaults';
import { validateVpcEndpointConfig } from './validate';
import { VpcEndpointNode } from './vpc-endpoint-node';
import { VpcEndpointInspector } from './vpc-endpoint-inspector';
import { VpcEndpointIcon } from '@/components/aws-icons';

export const vpcEndpointService: ServiceDefinition<VpcEndpointConfig> = {
  id: 'vpc-endpoint',
  cloudFormationType: 'AWS::EC2::VPCEndpoint',
  name: 'VPC Endpoint',
  shortName: 'VPC Endpoint',
  category: 'networking',
  description:
    'Private VPC connection to AWS services without traversing the public internet.',
  icon: VpcEndpointIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['private-service-access'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: [
    'vpc',
    'subnet',
    'security-group',
    'route-table',
    's3',
    'dynamodb',
    'ec2',
  ],

  createDefaultConfig: createDefaultVpcEndpointConfig,
  validate: validateVpcEndpointConfig,
  getDisplayName: getVpcEndpointDisplayName,

  NodeComponent: VpcEndpointNode,
  InspectorComponent: VpcEndpointInspector,

  aiHints: {
    summary: 'Private endpoint from a VPC to an AWS service.',
    role: 'Keeps service traffic on private AWS networking paths.',
    useCases: [
      'Private S3 access',
      'Interface endpoints for APIs',
      'Reducing public internet exposure',
    ],
    keyAttributes: ['endpointName', 'endpointType', 'serviceName'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: VpcEndpointConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::VPCEndpoint',
      name: getVpcEndpointDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.endpointType },
        { label: 'Service', value: config.serviceName },
      ],
    };
  },
};

export default vpcEndpointService;
