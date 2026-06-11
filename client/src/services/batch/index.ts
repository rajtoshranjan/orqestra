import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { BatchConfig } from './types';
import { createDefaultBatchConfig, getBatchDisplayName } from './defaults';
import { validateBatchConfig } from './validate';
import { BatchNode } from './batch-node';
import { BatchInspector } from './batch-inspector';
import { BatchIcon } from '@/components/icons';

export const batchService: ServiceDefinition<BatchConfig> = {
  id: 'batch',
  cloudFormationType: 'AWS::Batch::ComputeEnvironment',
  name: 'AWS Batch',
  shortName: 'Batch',
  category: 'compute',
  description:
    'Fully managed batch processing service for running large-scale parallel compute jobs on dynamically provisioned resources.',
  icon: BatchIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['batch-compute'],
  },
  allowedParents: ['region', 'vpc', 'subnet', 'environment'],
  allowedRelationships: [
    'ec2',
    'iam-role',
    'sqs',
    'cloudwatch',
    's3',
    'security-group',
  ],

  createDefaultConfig: createDefaultBatchConfig,
  validate: validateBatchConfig,
  getDisplayName: getBatchDisplayName,

  NodeComponent: BatchNode,
  InspectorComponent: BatchInspector,

  aiHints: {
    summary:
      'Fully managed batch processing service for large-scale parallel compute jobs.',
    role: 'Runs batch jobs on dynamically provisioned compute resources.',
    useCases: [
      'Data transformation pipelines',
      'ML training jobs',
      'Financial risk modelling',
      'Image/video processing',
    ],
    keyAttributes: ['computeEnvironmentName', 'computeType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: BatchConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Batch::ComputeEnvironment',
      name: getBatchDisplayName(config),
      connectionCount,
      details: [{ label: 'Compute Type', value: config.computeType }],
    };
  },
};

export default batchService;
