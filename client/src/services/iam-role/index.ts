import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { IAMRoleConfig } from './types';
import { createDefaultIAMRoleConfig, getIAMRoleDisplayName } from './defaults';
import { validateIAMRoleConfig } from './validate';
import { IAMRoleNode } from './iam-role-node';
import { IAMRoleInspector } from './iam-role-inspector';
import { IamRoleIcon } from '@/components/aws-icons';

export const iamRoleService: ServiceDefinition<IAMRoleConfig> = {
  id: 'iam-role',
  cloudFormationType: 'AWS::IAM::Role',
  name: 'AWS IAM Role',
  shortName: 'IAM Role',
  category: 'security',
  description:
    'Identity and Access Management role defining permission policies that determine what actions are allowed by AWS resources.',
  icon: IamRoleIcon,
  accentColor: '#DD344C',
  capabilities: {
    provides: ['execution-role'],
  },

  createDefaultConfig: createDefaultIAMRoleConfig,
  validate: validateIAMRoleConfig,
  getDisplayName: getIAMRoleDisplayName,

  NodeComponent: IAMRoleNode,
  InspectorComponent: IAMRoleInspector,

  buildPlanResource: (
    nodeId: string,
    config: IAMRoleConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::IAM::Role',
      name: getIAMRoleDisplayName(config),
      connectionCount,
      details: [
        { label: 'Role Name', value: config.roleName },
        {
          label: 'Managed Policies',
          value: String(config.managedPolicyArns?.length || 0),
        },
        {
          label: 'Inline Policies',
          value: String(config.inlinePolicies?.length || 0),
        },
      ],
    };
  },
};
export default iamRoleService;
