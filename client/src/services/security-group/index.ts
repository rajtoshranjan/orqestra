import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { SecurityGroupConfig } from './types';
import {
  createDefaultSecurityGroupConfig,
  getSecurityGroupDisplayName,
} from './defaults';
import { validateSecurityGroupConfig } from './validate';
import { SecurityGroupNode } from './security-group-node';
import { SecurityGroupInspector } from './security-group-inspector';
import { SecurityGroupIcon } from '@/components/aws-icons';

export const securityGroupService: ServiceDefinition<SecurityGroupConfig> = {
  id: 'security-group',
  cloudFormationType: 'AWS::EC2::SecurityGroup',
  name: 'AWS Security Group',
  shortName: 'Security Group',
  category: 'networking',
  description:
    'Security group acting as a virtual firewall for cloud resources to control inbound and outbound traffic.',
  icon: SecurityGroupIcon,
  accentColor: '#3F8624',
  capabilities: {
    provides: ['firewall-config'],
  },

  createDefaultConfig: createDefaultSecurityGroupConfig,
  validate: validateSecurityGroupConfig,
  getDisplayName: getSecurityGroupDisplayName,

  NodeComponent: SecurityGroupNode,
  InspectorComponent: SecurityGroupInspector,

  buildPlanResource: (
    nodeId: string,
    config: SecurityGroupConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::SecurityGroup',
      name: getSecurityGroupDisplayName(config),
      connectionCount,
      details: [
        {
          label: 'Inbound Rules',
          value: String(config.ingressRules?.length || 0),
        },
        {
          label: 'Outbound Rules',
          value: String(config.egressRules?.length || 0),
        },
      ],
    };
  },
};
export default securityGroupService;
