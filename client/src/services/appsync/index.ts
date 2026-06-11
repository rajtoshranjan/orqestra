import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { AppSyncConfig } from './types';
import { createDefaultAppSyncConfig, getAppSyncDisplayName } from './defaults';
import { validateAppSyncConfig } from './validate';
import { AppSyncNode } from './appsync-node';
import { AppSyncInspector } from './appsync-inspector';
import { AppSyncIcon } from '@/components/icons';

export const appSyncService: ServiceDefinition<AppSyncConfig> = {
  id: 'appsync',
  cloudFormationType: 'AWS::AppSync::GraphQLApi',
  name: 'AWS AppSync',
  shortName: 'AppSync',
  category: 'integration',
  description:
    'Managed GraphQL API service for connecting applications to data sources and real-time subscriptions.',
  icon: AppSyncIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['graphql-api'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'lambda',
    'dynamodb',
    'rds',
    'api-gateway',
    'cognito',
    'cloudwatch',
  ],

  createDefaultConfig: createDefaultAppSyncConfig,
  validate: validateAppSyncConfig,
  getDisplayName: getAppSyncDisplayName,

  NodeComponent: AppSyncNode,
  InspectorComponent: AppSyncInspector,

  aiHints: {
    summary:
      'Managed GraphQL API layer that connects clients to AWS data sources.',
    role: 'Exposes typed APIs and real-time subscriptions over application data.',
    useCases: [
      'GraphQL APIs',
      'Mobile and web backends',
      'Real-time subscriptions',
    ],
    keyAttributes: ['apiName', 'authenticationType', 'apiType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: AppSyncConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::AppSync::GraphQLApi',
      name: getAppSyncDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.apiType },
        { label: 'Auth', value: config.authenticationType },
      ],
    };
  },
};

export default appSyncService;
