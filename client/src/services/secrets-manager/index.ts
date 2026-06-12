import { SecretsManagerIcon } from '@/components/icons';

import {
  createDefaultSecretsManagerConfig,
  getSecretsManagerDisplayName,
} from './defaults';
import { SecretsManagerInspector } from './secrets-manager-inspector';
import { SecretsManagerNode } from './secrets-manager-node';
import { validateSecretsManagerConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { SecretsManagerConfig } from './types';

export const secretsManagerService: ServiceDefinition<SecretsManagerConfig> = {
  id: 'secrets-manager',
  cloudFormationType: 'AWS::SecretsManager::Secret',
  name: 'Secrets Manager',
  shortName: 'Secrets',
  category: 'security',
  description:
    'Securely stores, manages, and rotates application secrets and credentials.',
  icon: SecretsManagerIcon,
  accentColor: '#DD344C',
  isContainer: false,
  capabilities: {
    provides: ['secret-store'],
  },
  allowedParents: ['account', 'region', 'environment'],
  allowedRelationships: [
    'lambda',
    'ec2',
    'rds',
    'kms',
    'iam-role',
    'documentdb',
    'neptune',
    'opensearch',
  ],

  createDefaultConfig: createDefaultSecretsManagerConfig,
  validate: validateSecretsManagerConfig,
  getDisplayName: getSecretsManagerDisplayName,

  NodeComponent: SecretsManagerNode,
  InspectorComponent: SecretsManagerInspector,

  aiHints: {
    summary:
      'Securely stores, manages, and rotates application secrets and credentials.',
    role: 'Central secrets vault preventing hardcoded credentials in application code.',
    useCases: [
      'Database credentials',
      'API keys',
      'OAuth tokens',
      'TLS certificates',
    ],
    keyAttributes: ['secretName', 'rotationEnabled'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: SecretsManagerConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::SecretsManager::Secret',
      name: getSecretsManagerDisplayName(config),
      connectionCount,
      details: [
        {
          label: 'Rotation',
          value: config.rotationEnabled ? 'Enabled' : 'Disabled',
        },
      ],
    };
  },
};

export default secretsManagerService;
