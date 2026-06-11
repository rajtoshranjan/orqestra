import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { InternetGatewayConfig } from './types';
import {
  createDefaultInternetGatewayConfig,
  getInternetGatewayDisplayName,
} from './defaults';
import { validateInternetGatewayConfig } from './validate';
import { InternetGatewayNode } from './internet-gateway-node';
import { InternetGatewayInspector } from './internet-gateway-inspector';
import { InternetGatewayIcon } from '@/components/icons';

export const internetGatewayService: ServiceDefinition<InternetGatewayConfig> =
{
  id: 'internet-gateway',
  cloudFormationType: 'AWS::EC2::InternetGateway',
  name: 'Internet Gateway',
  shortName: 'IGW',
  category: 'networking',
  description:
    'Connects a VPC to the internet for bidirectional traffic between the VPC and the internet.',
  icon: InternetGatewayIcon,
  accentColor: '#29B0D9',
  isContainer: false,
  capabilities: {
    provides: ['internet-access'],
  },
  allowedParents: ['vpc', 'region'],
  allowedRelationships: ['vpc', 'route-table', 'nat-gateway'],

  createDefaultConfig: createDefaultInternetGatewayConfig,
  validate: validateInternetGatewayConfig,
  getDisplayName: getInternetGatewayDisplayName,

  NodeComponent: InternetGatewayNode,
  InspectorComponent: InternetGatewayInspector,

  buildPlanResource: (
    nodeId: string,
    config: InternetGatewayConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::InternetGateway',
      name: getInternetGatewayDisplayName(config),
      connectionCount,
      details: [{ label: 'Name', value: config.gatewayName }],
    };
  },

  aiHints: {
    summary: 'Connects a VPC to the internet for bidirectional traffic.',
    role: 'Provides public internet access for VPC resources.',
    useCases: [
      'Public subnet internet access',
      'Internet-facing load balancers',
    ],
    keyAttributes: ['gatewayName'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,
};

export default internetGatewayService;
