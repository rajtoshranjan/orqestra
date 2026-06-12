import { VpcIcon } from '@/components/icons';

import { createDefaultVPCConfig, getVPCDisplayName } from './defaults';
import { validateVPCConfig } from './validate';
import { VPCInspector } from './vpc-inspector';
import { VPCNode } from './vpc-node';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { VPCConfig } from './types';

export const vpcService: ServiceDefinition<VPCConfig> = {
  id: 'vpc',
  cloudFormationType: 'AWS::EC2::VPC',
  name: 'AWS VPC',
  shortName: 'VPC',
  category: 'networking',
  description:
    'Virtual Private Cloud — isolate and secure cloud infrastructure resources.',
  icon: VpcIcon,
  accentColor: '#A166FF',
  capabilities: {
    provides: ['network-container'],
  },
  allowedParents: ['region', 'account', 'environment'],
  isContainer: true,

  createDefaultConfig: createDefaultVPCConfig,
  validate: validateVPCConfig,
  getDisplayName: getVPCDisplayName,

  NodeComponent: VPCNode,
  InspectorComponent: VPCInspector,

  buildPlanResource: (
    nodeId: string,
    config: VPCConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::VPC',
      name: getVPCDisplayName(config),
      connectionCount,
      details: [
        { label: 'CIDR', value: config.cidrBlock },
        {
          label: 'DNS Hostnames',
          value: config.enableDnsHostnames ? 'Yes' : 'No',
        },
      ],
    };
  },
};
export default vpcService;
