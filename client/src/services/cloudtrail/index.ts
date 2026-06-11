import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { CloudTrailConfig } from './types';
import {
  createDefaultCloudTrailConfig,
  getCloudTrailDisplayName,
} from './defaults';
import { validateCloudTrailConfig } from './validate';
import { CloudTrailNode } from './cloudtrail-node';
import { CloudTrailInspector } from './cloudtrail-inspector';
import { CloudTrailIcon } from '@/components/icons';

export const cloudTrailService: ServiceDefinition<CloudTrailConfig> = {
  id: 'cloudtrail',
  cloudFormationType: 'AWS::CloudTrail::Trail',
  name: 'AWS CloudTrail',
  shortName: 'CloudTrail',
  category: 'monitoring',
  description:
    'Governance and audit logging service for AWS API activity and account events.',
  icon: CloudTrailIcon,
  accentColor: '#FF4F8B',
  capabilities: {
    provides: ['audit-log'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: ['s3', 'cloudwatch', 'kms', 'sns', 'guardduty'],

  createDefaultConfig: createDefaultCloudTrailConfig,
  validate: validateCloudTrailConfig,
  getDisplayName: getCloudTrailDisplayName,

  NodeComponent: CloudTrailNode,
  InspectorComponent: CloudTrailInspector,

  aiHints: {
    summary: 'Audit log trail for AWS API and account activity.',
    role: 'Records governance events used for compliance and investigations.',
    useCases: [
      'Compliance audit logging',
      'Security investigations',
      'Account activity monitoring',
    ],
    keyAttributes: ['trailName', 'destinationBucketName', 'managementEvents'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: CloudTrailConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::CloudTrail::Trail',
      name: getCloudTrailDisplayName(config),
      connectionCount,
      details: [
        { label: 'Bucket', value: config.destinationBucketName },
        { label: 'Events', value: config.managementEvents },
      ],
    };
  },
};

export default cloudTrailService;
