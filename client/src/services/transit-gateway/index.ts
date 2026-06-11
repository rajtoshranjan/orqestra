import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { TransitGatewayConfig } from './types';
import {
  createDefaultTransitGatewayConfig,
  getTransitGatewayDisplayName,
} from './defaults';
import { validateTransitGatewayConfig } from './validate';
import { TransitGatewayNode } from './transit-gateway-node';
import { TransitGatewayInspector } from './transit-gateway-inspector';
import { TransitGatewayIcon } from '@/components/icons';

export const transitGatewayService: ServiceDefinition<TransitGatewayConfig> = {
  id: 'transit-gateway',
  cloudFormationType: 'AWS::EC2::TransitGateway',
  name: 'Transit Gateway',
  shortName: 'TGW',
  category: 'networking',
  description:
    'Hub that connects VPCs and on-premises networks through a central routing point, simplifying complex network topologies.',
  icon: TransitGatewayIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['transit-routing'],
  },
  allowedParents: ['region', 'account'],
  allowedRelationships: ['vpc', 'route-table', 'subnet'],

  createDefaultConfig: createDefaultTransitGatewayConfig,
  validate: validateTransitGatewayConfig,
  getDisplayName: getTransitGatewayDisplayName,

  NodeComponent: TransitGatewayNode,
  InspectorComponent: TransitGatewayInspector,

  aiHints: {
    summary:
      'Hub that connects VPCs and on-premises networks through a central routing point.',
    role: 'Simplifies complex network topologies by acting as a cloud router.',
    useCases: [
      'Multi-VPC connectivity',
      'Hybrid cloud networking',
      'Centralized routing',
    ],
    keyAttributes: ['transitGatewayName', 'amazonSideAsn'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: TransitGatewayConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::TransitGateway',
      name: getTransitGatewayDisplayName(config),
      connectionCount,
      details: [{ label: 'ASN', value: String(config.amazonSideAsn) }],
    };
  },
};

export default transitGatewayService;
