import type {
  ServiceDefinition,
  ServicePlanResource,
  DeploymentHints,
} from '../types';
import type { RouteTableConfig } from './types';
import {
  createDefaultRouteTableConfig,
  getRouteTableDisplayName,
} from './defaults';
import { validateRouteTableConfig } from './validate';
import { RouteTableNode } from './route-table-node';
import { RouteTableInspector } from './route-table-inspector';
import { RouteTableIcon } from '@/components/icons';

export const routeTableService: ServiceDefinition<RouteTableConfig> = {
  id: 'route-table',
  cloudFormationType: 'AWS::EC2::RouteTable',
  name: 'Route Table',
  shortName: 'Route Table',
  category: 'networking',
  description:
    'Controls the routing of network traffic within a VPC by mapping destination CIDRs to targets.',
  icon: RouteTableIcon,
  accentColor: '#29B0D9',
  isContainer: false,
  capabilities: {
    provides: ['routing'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: [
    'subnet',
    'internet-gateway',
    'nat-gateway',
    'vpc',
    'vpc-endpoint',
  ],

  createDefaultConfig: createDefaultRouteTableConfig,
  validate: validateRouteTableConfig,
  getDisplayName: getRouteTableDisplayName,

  NodeComponent: RouteTableNode,
  InspectorComponent: RouteTableInspector,

  buildPlanResource: (
    nodeId: string,
    config: RouteTableConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::RouteTable',
      name: getRouteTableDisplayName(config),
      connectionCount,
      details: [{ label: 'Name', value: config.routeTableName }],
    };
  },

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,
};

export default routeTableService;
