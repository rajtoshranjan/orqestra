import { SesIcon } from '@/components/icons';

import { createDefaultSesConfig, getSesDisplayName } from './defaults';
import { SesInspector } from './ses-inspector';
import { SesNode } from './ses-node';
import { validateSesConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { SesConfig } from './types';

export const sesService: ServiceDefinition<SesConfig> = {
  id: 'ses',
  cloudFormationType: 'AWS::SES::EmailIdentity',
  name: 'Amazon SES',
  shortName: 'SES',
  category: 'messaging',
  description:
    'Email sending and receiving service for transactional and notification workloads.',
  icon: SesIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['email-service'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'sns',
    'lambda',
    'cloudwatch',
    'route53',
    's3',
    'iam-role',
    'cloudtrail',
  ],

  createDefaultConfig: createDefaultSesConfig,
  validate: validateSesConfig,
  getDisplayName: getSesDisplayName,

  NodeComponent: SesNode,
  InspectorComponent: SesInspector,

  aiHints: {
    summary: 'Managed email service for sending and receiving messages.',
    role: 'Delivers transactional email and domain-verified notifications.',
    useCases: [
      'Transactional email',
      'Notification delivery',
      'Inbound email processing',
    ],
    keyAttributes: ['identityName', 'identityType', 'mailFromDomain'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: SesConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::SES::EmailIdentity',
      name: getSesDisplayName(config),
      connectionCount,
      details: [
        { label: 'Identity', value: config.identityType },
        { label: 'MAIL FROM', value: config.mailFromDomain },
      ],
    };
  },
};

export default sesService;
