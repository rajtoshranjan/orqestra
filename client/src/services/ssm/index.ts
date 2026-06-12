import { SsmIcon } from '@/components/icons';

import { createDefaultSsmConfig, getSsmDisplayName } from './defaults';
import { SsmInspector } from './ssm-inspector';
import { SsmNode } from './ssm-node';
import { validateSsmConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { SsmConfig } from './types';

export const ssmService: ServiceDefinition<SsmConfig> = {
  id: 'ssm',
  cloudFormationType: 'AWS::SSM::Parameter',
  name: 'AWS Systems Manager Parameter Store',
  shortName: 'SSM Parameter',
  category: 'security',
  description:
    'Parameter Store entry for application configuration and operational values.',
  icon: SsmIcon,
  accentColor: '#DD344C',
  capabilities: {
    provides: ['configuration-parameter'],
  },
  allowedParents: ['account', 'region', 'environment'],
  allowedRelationships: [
    'lambda',
    'ec2',
    'ecs-cluster',
    'eks-cluster',
    'iam-role',
    'kms',
    'secrets-manager',
  ],

  createDefaultConfig: createDefaultSsmConfig,
  validate: validateSsmConfig,
  getDisplayName: getSsmDisplayName,

  NodeComponent: SsmNode,
  InspectorComponent: SsmInspector,

  aiHints: {
    summary: 'Configuration parameter stored in AWS Systems Manager.',
    role: 'Provides centrally managed application and infrastructure settings.',
    useCases: ['Application config', 'Runtime parameters', 'Secure strings'],
    keyAttributes: ['parameterName', 'parameterType', 'tier'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: SsmConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::SSM::Parameter',
      name: getSsmDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.parameterType },
        { label: 'Tier', value: config.tier },
      ],
    };
  },
};

export default ssmService;
