import { AppRunnerIcon } from '@/components/icons';

import { AppRunnerInspector } from './app-runner-inspector';
import { AppRunnerNode } from './app-runner-node';
import {
  createDefaultAppRunnerConfig,
  getAppRunnerDisplayName,
} from './defaults';
import { validateAppRunnerConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { AppRunnerConfig } from './types';

export const appRunnerService: ServiceDefinition<AppRunnerConfig> = {
  id: 'app-runner',
  cloudFormationType: 'AWS::AppRunner::Service',
  name: 'AWS App Runner',
  shortName: 'App Runner',
  category: 'compute',
  description:
    'Fully managed service for deploying containerised web applications and APIs with zero infrastructure management.',
  icon: AppRunnerIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['managed-app'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'ecr',
    'iam-role',
    'cloudwatch',
    'vpc',
    'secrets-manager',
    'rds',
  ],

  createDefaultConfig: createDefaultAppRunnerConfig,
  validate: validateAppRunnerConfig,
  getDisplayName: getAppRunnerDisplayName,

  NodeComponent: AppRunnerNode,
  InspectorComponent: AppRunnerInspector,

  aiHints: {
    summary:
      'Fully managed service for deploying containerised web applications with zero infrastructure management.',
    role: 'Automatically builds and deploys web apps from source or container images.',
    useCases: [
      'Rapid web app deployment',
      'Microservice hosting',
      'API backends',
      'Prototype-to-production workloads',
    ],
    keyAttributes: ['serviceName', 'cpu', 'memory'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: AppRunnerConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::AppRunner::Service',
      name: getAppRunnerDisplayName(config),
      connectionCount,
      details: [
        { label: 'CPU', value: config.cpu },
        { label: 'Memory', value: config.memory },
      ],
    };
  },
};

export default appRunnerService;
