import { KmsIcon } from '@/components/icons';

import { createDefaultKMSConfig, getKMSDisplayName } from './defaults';
import { KMSInspector } from './kms-inspector';
import { KMSNode } from './kms-node';
import { validateKMSConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { KMSConfig } from './types';

export const kmsService: ServiceDefinition<KMSConfig> = {
  id: 'kms',
  cloudFormationType: 'AWS::KMS::Key',
  name: 'AWS KMS',
  shortName: 'KMS',
  category: 'security',
  description: 'Managed encryption key service for protecting data at rest.',
  icon: KmsIcon,
  accentColor: '#DD344C',
  isContainer: false,
  capabilities: {
    provides: ['encryption-key'],
  },
  allowedParents: ['account', 'region', 'environment'],
  allowedRelationships: [
    's3',
    'rds',
    'dynamodb',
    'lambda',
    'secrets-manager',
    'iam-role',
    'sqs',
    'sns',
    'ec2',
    'cloudtrail',
    'ssm',
    'opensearch',
    'sagemaker',
    'documentdb',
    'neptune',
  ],

  createDefaultConfig: createDefaultKMSConfig,
  validate: validateKMSConfig,
  getDisplayName: getKMSDisplayName,

  NodeComponent: KMSNode,
  InspectorComponent: KMSInspector,

  aiHints: {
    summary: 'Managed encryption key service for protecting data at rest.',
    role: 'Provides centralized key management for encrypting AWS resources.',
    useCases: [
      'S3 bucket encryption',
      'RDS database encryption',
      'Lambda environment variable encryption',
    ],
    keyAttributes: ['keyAlias', 'keyUsage', 'multiRegion'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: KMSConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::KMS::Key',
      name: getKMSDisplayName(config),
      connectionCount,
      details: [
        { label: 'Key Usage', value: config.keyUsage },
        { label: 'Multi-Region', value: config.multiRegion ? 'Yes' : 'No' },
      ],
    };
  },
};

export default kmsService;
