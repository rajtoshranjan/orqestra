import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { LambdaConfig } from './types';
import { createDefaultLambdaConfig, getLambdaDisplayName } from './defaults';
import { validateLambdaConfig } from './validate';
import { LambdaNode } from './lambda-node';
import { LambdaInspector } from './lambda-inspector';
import { LambdaIcon } from '@/components/aws-icons';

export const lambdaService: ServiceDefinition<LambdaConfig> = {
  /* Identity. */
  id: 'lambda',
  cloudFormationType: 'AWS::Lambda::Function',
  name: 'AWS Lambda',
  shortName: 'Lambda',
  category: 'compute',
  description:
    'Serverless compute — run code with no servers to manage. Configure runtime, memory, timeout, handler, and environment variables.',
  icon: LambdaIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['compute'],
    requires: ['execution-role'],
    optional: [
      'compute-artifact',
      'network-attachment',
      'file-system',
      'event-source',
      'lambda-layer',
    ],
  },
  allowedParents: ['subnet', 'app-group', 'vpc'],
  forbiddenParents: ['s3', 'iam-role', 'security-group', 'ecr'],
  allowedRelationships: [
    'eventbridge',
    'api-gateway',
    'sqs',
    'sns',
    'iam-role',
    'dynamodb',
    'efs',
    'ecr',
    'cloudwatch',
    'lambda-layer',
  ],
  forbiddenRelationships: [
    'lambda',
    'vpc',
    'subnet',
    'security-group',
    'route-table',
    'nat-gateway',
    'internet-gateway',
  ],

  /* Config. */
  createDefaultConfig: createDefaultLambdaConfig,
  validate: validateLambdaConfig,
  getDisplayName: getLambdaDisplayName,

  /* UI. */
  NodeComponent: LambdaNode,
  InspectorComponent: LambdaInspector,

  /* Plan. */
  buildPlanResource: (
    nodeId: string,
    config: LambdaConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    const envCount = config.environmentVariables.filter(
      (e) => e.key.trim() || e.value.trim(),
    ).length;

    return {
      id: nodeId,
      cloudFormationType: 'AWS::Lambda::Function',
      name: getLambdaDisplayName(config),
      connectionCount,
      details: [
        { label: 'Runtime', value: config.runtime },
        { label: 'Memory', value: `${config.memorySize} MB` },
        { label: 'Timeout', value: `${config.timeout}s` },
        { label: 'Env vars', value: String(envCount) },
      ],
    };
  },
};
