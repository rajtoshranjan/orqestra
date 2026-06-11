import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { CodeDeployConfig } from './types';
import {
  createDefaultCodeDeployConfig,
  getCodeDeployDisplayName,
} from './defaults';
import { validateCodeDeployConfig } from './validate';
import { CodeDeployNode } from './codedeploy-node';
import { CodeDeployInspector } from './codedeploy-inspector';
import { CodeDeployIcon } from '@/components/icons';

export const codedeployService: ServiceDefinition<CodeDeployConfig> = {
  id: 'codedeploy',
  cloudFormationType: 'AWS::CodeDeploy::Application',
  name: 'AWS CodeDeploy',
  shortName: 'CodeDeploy',
  category: 'integration',
  description:
    'Fully managed deployment service that automates application deployments to compute services.',
  icon: CodeDeployIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['deployment-service'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    'codepipeline',
    'ec2',
    'ecs-cluster',
    'lambda',
    'iam-role',
    'cloudwatch',
    'sns',
  ],

  createDefaultConfig: createDefaultCodeDeployConfig,
  validate: validateCodeDeployConfig,
  getDisplayName: getCodeDeployDisplayName,

  NodeComponent: CodeDeployNode,
  InspectorComponent: CodeDeployInspector,

  aiHints: {
    summary: 'Automates application deployments to compute services.',
    role: 'Manages rolling, blue-green, and canary deployments.',
    useCases: [
      'Zero-downtime deployments',
      'Automated rollbacks',
      'Canary releases',
      'Lambda function deployments',
    ],
    keyAttributes: ['applicationName', 'computePlatform'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: CodeDeployConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::CodeDeploy::Application',
      name: getCodeDeployDisplayName(config),
      connectionCount,
      details: [{ label: 'Platform', value: config.computePlatform }],
    };
  },
};

export default codedeployService;
