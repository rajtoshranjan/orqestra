import { CodePipelineIcon } from '@/components/icons';

import { CodePipelineInspector } from './codepipeline-inspector';
import { CodePipelineNode } from './codepipeline-node';
import {
  createDefaultCodePipelineConfig,
  getCodePipelineDisplayName,
} from './defaults';
import { validateCodePipelineConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { CodePipelineConfig } from './types';

export const codepipelineService: ServiceDefinition<CodePipelineConfig> = {
  id: 'codepipeline',
  cloudFormationType: 'AWS::CodePipeline::Pipeline',
  name: 'AWS CodePipeline',
  shortName: 'CodePipeline',
  category: 'integration',
  description:
    'Fully managed continuous delivery service for fast and reliable application and infrastructure updates.',
  icon: CodePipelineIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['ci-pipeline'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'codebuild',
    'codedeploy',
    's3',
    'iam-role',
    'cloudwatch',
    'sns',
    'ecr',
    'ecs-cluster',
  ],

  createDefaultConfig: createDefaultCodePipelineConfig,
  validate: validateCodePipelineConfig,
  getDisplayName: getCodePipelineDisplayName,

  NodeComponent: CodePipelineNode,
  InspectorComponent: CodePipelineInspector,

  aiHints: {
    summary:
      'Fully managed continuous delivery service for fast and reliable updates.',
    role: 'Automates the build, test, and deploy phases of a release pipeline.',
    useCases: [
      'Continuous deployment',
      'Multi-stage release pipelines',
      'Blue-green deployments',
      'Infrastructure as code deployment',
    ],
    keyAttributes: ['pipelineName', 'pipelineType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: CodePipelineConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::CodePipeline::Pipeline',
      name: getCodePipelineDisplayName(config),
      connectionCount,
      details: [{ label: 'Type', value: config.pipelineType }],
    };
  },
};

export default codepipelineService;
