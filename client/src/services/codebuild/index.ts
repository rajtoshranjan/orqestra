import { CodeBuildIcon } from '@/components/icons';

import { CodeBuildInspector } from './codebuild-inspector';
import { CodeBuildNode } from './codebuild-node';
import {
  createDefaultCodeBuildConfig,
  getCodeBuildDisplayName,
} from './defaults';
import { validateCodeBuildConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { CodeBuildConfig } from './types';

export const codebuildService: ServiceDefinition<CodeBuildConfig> = {
  id: 'codebuild',
  cloudFormationType: 'AWS::CodeBuild::Project',
  name: 'AWS CodeBuild',
  shortName: 'CodeBuild',
  category: 'integration',
  description:
    'Fully managed build service that compiles source code, runs tests, and produces deployable software packages.',
  icon: CodeBuildIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['build-service'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'codepipeline',
    'ecr',
    's3',
    'iam-role',
    'cloudwatch',
    'vpc',
    'security-group',
  ],

  createDefaultConfig: createDefaultCodeBuildConfig,
  validate: validateCodeBuildConfig,
  getDisplayName: getCodeBuildDisplayName,

  NodeComponent: CodeBuildNode,
  InspectorComponent: CodeBuildInspector,

  aiHints: {
    summary:
      'Fully managed build service that compiles source code and produces deployable packages.',
    role: 'Runs build jobs including compilation, testing, and artifact creation.',
    useCases: [
      'Docker image builds',
      'Unit test execution',
      'Static analysis',
      'Deployment package creation',
    ],
    keyAttributes: ['projectName', 'buildImage', 'computeType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: CodeBuildConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::CodeBuild::Project',
      name: getCodeBuildDisplayName(config),
      connectionCount,
      details: [
        {
          label: 'Compute',
          value: config.computeType.replace('BUILD_GENERAL1_', ''),
        },
      ],
    };
  },
};

export default codebuildService;
