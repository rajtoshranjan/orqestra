import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { CognitoConfig } from './types';
import {
  createDefaultCognitoConfig,
  getCognitoDisplayName,
} from './defaults';
import { validateCognitoConfig } from './validate';
import { CognitoNode } from './cognito-node';
import { CognitoInspector } from './cognito-inspector';
import { CognitoIcon } from '@/components/aws-icons';

export const cognitoService: ServiceDefinition<CognitoConfig> = {
  id: 'cognito',
  cloudFormationType: 'AWS::Cognito::UserPool',
  name: 'Amazon Cognito',
  shortName: 'Cognito',
  category: 'security',
  description:
    'User identity and access management service for web and mobile applications.',
  icon: CognitoIcon,
  accentColor: '#BF5AF2',
  isContainer: false,
  capabilities: {
    provides: ['auth-service'],
  },
  allowedParents: ['region', 'account', 'environment'],
  allowedRelationships: ['lambda', 'api-gateway', 'kms', 'sns'],

  createDefaultConfig: createDefaultCognitoConfig,
  validate: validateCognitoConfig,
  getDisplayName: getCognitoDisplayName,

  NodeComponent: CognitoNode,
  InspectorComponent: CognitoInspector,

  aiHints: {
    summary:
      'User identity and access management service for web and mobile applications.',
    role: 'Handles user registration, authentication, and authorization.',
    useCases: [
      'User sign-up and sign-in',
      'Social identity federation',
      'API Gateway authorization',
    ],
    keyAttributes: ['userPoolName', 'mfaConfiguration', 'selfSignUpEnabled'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: CognitoConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Cognito::UserPool',
      name: getCognitoDisplayName(config),
      connectionCount,
      details: [
        { label: 'MFA', value: config.mfaConfiguration },
        { label: 'Self Sign-Up', value: config.selfSignUpEnabled ? 'Yes' : 'No' },
      ],
    };
  },
};

export default cognitoService;
