import type {
  ServiceDefinition,
  ServicePlanResource,
  SecurityScanRule,
  AIHints,
} from '../types';
import type { IAMRoleConfig } from './types';
import { createDefaultIAMRoleConfig, getIAMRoleDisplayName } from './defaults';
import { validateIAMRoleConfig } from './validate';
import { IAMRoleNode } from './iam-role-node';
import { IAMRoleInspector } from './iam-role-inspector';
import { IamRoleIcon } from '@/components/icons';

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

  securityRules: [
    {
      id: 'iam-wildcard-trust-policy',
      severity: 'high',
      title: 'Wildcard Actions in Trust Policy',
      description: (name) =>
        `IAM Role "${name}" contains wildcard actions or resources in its assume-role trust document.`,
      check: (config) => {
        const trust = (config.assumeRolePolicyDocument as string) ?? '';
        return (
          trust.includes('"Action": "*"') || trust.includes('"Resource": "*"')
        );
      },
    },
    {
      id: 'iam-wildcard-inline-policy',
      severity: 'high',
      title: 'Overly Broad IAM Policy Permissions',
      description: (name) =>
        `IAM Role "${name}" has inline policies with wildcard "*" actions or resources.`,
      check: (config) => {
        const inline =
          (config.inlinePolicies as Array<{ document?: string }>) ?? [];
        return inline.some(
          (policy) =>
            policy.document?.includes('"Action": "*"') ||
            policy.document?.includes('"Resource": "*"') ||
            policy.document?.includes('"*": "*"'),
        );
      },
    },
  ] satisfies SecurityScanRule[],

  aiHints: {
    summary:
      'IAM Role that grants AWS services and resources specific permissions.',
    role: 'Defines the permission boundary for a resource — what it can and cannot do in AWS.',
    useCases: [
      'Lambda execution roles',
      'EC2 instance profiles',
      'Cross-account access delegation',
      'Service-to-service permissions',
    ],
    keyAttributes: [
      'roleName',
      'managedPolicyArns',
      'inlinePolicies',
      'assumeRolePolicyDocument',
    ],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true },

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
