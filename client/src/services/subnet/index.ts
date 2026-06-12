import { SubnetIcon } from '@/components/icons';

import { createDefaultSubnetConfig, getSubnetDisplayName } from './defaults';
import { SubnetInspector } from './subnet-inspector';
import { SubnetNode } from './subnet-node';
import { validateSubnetConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  ValidationRule,
  AIHints,
} from '../types';
import type { SubnetConfig } from './types';

export const subnetService: ServiceDefinition<SubnetConfig> = {
  id: 'subnet',
  cloudFormationType: 'AWS::EC2::Subnet',
  name: 'AWS Subnet',
  shortName: 'Subnet',
  category: 'networking',
  description: 'Subnet within a VPC. Can be private or public.',
  icon: SubnetIcon,
  accentColor: '#3F8624',
  capabilities: {
    provides: ['network-attachment'],
  },
  allowedParents: ['vpc', 'region', 'environment'],
  isContainer: true,

  validationRules: [
    {
      id: 'subnet-requires-vpc-parent',
      message: 'Subnet must be placed inside or connected to a VPC.',
      check: ({ node, nodes, edges }) => {
        let current = nodes.find((n) => n.id === node.parentNode);
        while (current) {
          if (current.data.serviceId === 'vpc') return false;
          current = nodes.find((n) => n.id === current!.parentNode);
        }

        const hasVpcEdge = edges.some((edge) => {
          const otherId = edge.source === node.id ? edge.target : edge.source;
          return nodes.find((n) => n.id === otherId)?.data.serviceId === 'vpc';
        });
        return !hasVpcEdge;
      },
    },
  ] satisfies ValidationRule[],

  aiHints: {
    summary: 'A range of IP addresses within a VPC that segments the network.',
    role: 'Provides network isolation — public subnets have internet access, private subnets do not.',
    useCases: [
      'Hosting compute resources with controlled network access',
      'Separating public-facing from private infrastructure',
      'Multi-AZ high availability architectures',
    ],
    keyAttributes: ['cidrBlock', 'availabilityZone', 'subnetType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true },

  createDefaultConfig: createDefaultSubnetConfig,
  validate: validateSubnetConfig,
  getDisplayName: getSubnetDisplayName,

  NodeComponent: SubnetNode,
  InspectorComponent: SubnetInspector,

  buildPlanResource: (
    nodeId: string,
    config: SubnetConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::Subnet',
      name: getSubnetDisplayName(config),
      connectionCount,
      details: [
        { label: 'CIDR', value: config.cidrBlock },
        { label: 'AZ', value: config.availabilityZone },
        { label: 'Type', value: config.subnetType },
      ],
    };
  },
};
export default subnetService;
