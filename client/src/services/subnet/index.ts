import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { SubnetConfig } from './types';
import { createDefaultSubnetConfig, getSubnetDisplayName } from './defaults';
import { validateSubnetConfig } from './validate';
import { SubnetNode } from './subnet-node';
import { SubnetInspector } from './subnet-inspector';
import { SubnetIcon } from '@/components/aws-icons';

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
