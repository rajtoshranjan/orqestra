import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { GuardDutyConfig } from './types';
import {
  createDefaultGuardDutyConfig,
  getGuardDutyDisplayName,
} from './defaults';
import { validateGuardDutyConfig } from './validate';
import { GuardDutyNode } from './guardduty-node';
import { GuardDutyInspector } from './guardduty-inspector';
import { GuardDutyIcon } from '@/components/icons';

export const guardDutyService: ServiceDefinition<GuardDutyConfig> = {
  id: 'guardduty',
  cloudFormationType: 'AWS::GuardDuty::Detector',
  name: 'Amazon GuardDuty',
  shortName: 'GuardDuty',
  category: 'security',
  description:
    'Threat detection service that continuously monitors AWS account and workload activity.',
  icon: GuardDutyIcon,
  accentColor: '#DD344C',
  capabilities: {
    provides: ['threat-detection'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: ['cloudtrail', 's3', 'sns', 'cloudwatch', 'waf'],

  createDefaultConfig: createDefaultGuardDutyConfig,
  validate: validateGuardDutyConfig,
  getDisplayName: getGuardDutyDisplayName,

  NodeComponent: GuardDutyNode,
  InspectorComponent: GuardDutyInspector,

  aiHints: {
    summary: 'Threat detection service for AWS accounts and workloads.',
    role: 'Surfaces suspicious activity findings for security response.',
    useCases: [
      'Account threat detection',
      'Malware and anomaly monitoring',
      'Security operations workflows',
    ],
    keyAttributes: ['detectorName', 'findingPublishingFrequency'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: GuardDutyConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::GuardDuty::Detector',
      name: getGuardDutyDisplayName(config),
      connectionCount,
      details: [
        {
          label: 'Publishing',
          value: config.findingPublishingFrequency,
        },
      ],
    };
  },
};

export default guardDutyService;
