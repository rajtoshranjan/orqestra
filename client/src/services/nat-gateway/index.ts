import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { NatGatewayConfig } from './types';
import {
  createDefaultNatGatewayConfig,
  getNatGatewayDisplayName,
} from './defaults';
import { validateNatGatewayConfig } from './validate';
import { NatGatewayNode } from './nat-gateway-node';
import { NatGatewayInspector } from './nat-gateway-inspector';
import { NatGatewayIcon } from '@/components/icons';

export const natGatewayService: ServiceDefinition<NatGatewayConfig> = {
  id: 'nat-gateway',
  cloudFormationType: 'AWS::EC2::NatGateway',
  name: 'AWS NAT Gateway',
  shortName: 'NAT GW',
  category: 'networking',
  description:
    'Enables private subnet resources to initiate outbound internet traffic without exposing them to inbound connections.',
  icon: NatGatewayIcon,
  accentColor: '#29B0D9',
  isContainer: false,
  capabilities: {
    provides: ['nat-service'],
  },
  allowedParents: ['subnet', 'vpc', 'availability-zone'],
  allowedRelationships: ['subnet', 'route-table', 'internet-gateway', 'vpc'],

  createDefaultConfig: createDefaultNatGatewayConfig,
  validate: validateNatGatewayConfig,
  getDisplayName: getNatGatewayDisplayName,

  NodeComponent: NatGatewayNode,
  InspectorComponent: NatGatewayInspector,

  buildPlanResource: (
    nodeId: string,
    config: NatGatewayConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::NatGateway',
      name: getNatGatewayDisplayName(config),
      connectionCount,
      details: [{ label: 'Connectivity', value: config.connectivityType }],
    };
  },

  aiHints: {
    summary:
      'Enables private subnet resources to initiate outbound internet traffic.',
    role: 'Provides secure outbound internet access for private subnets.',
    useCases: [
      'Private Lambda internet access',
      'Private EC2 outbound traffic',
    ],
    keyAttributes: ['natGatewayName', 'connectivityType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,
};

export default natGatewayService;
