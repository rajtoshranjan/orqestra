import { SageMakerIcon } from '@/components/icons';

import {
  createDefaultSageMakerConfig,
  getSageMakerDisplayName,
} from './defaults';
import { SageMakerInspector } from './sagemaker-inspector';
import { SageMakerNode } from './sagemaker-node';
import { validateSageMakerConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { SageMakerConfig } from './types';

export const sageMakerService: ServiceDefinition<SageMakerConfig> = {
  id: 'sagemaker',
  cloudFormationType: 'AWS::SageMaker::NotebookInstance',
  name: 'Amazon SageMaker',
  shortName: 'SageMaker',
  category: 'compute',
  description:
    'Managed machine learning service for notebooks, training, and model deployment.',
  icon: SageMakerIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['ml-workload'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: [
    's3',
    'ecr',
    'iam-role',
    'cloudwatch',
    'kms',
    'security-group',
    'efs',
  ],

  createDefaultConfig: createDefaultSageMakerConfig,
  validate: validateSageMakerConfig,
  getDisplayName: getSageMakerDisplayName,

  NodeComponent: SageMakerNode,
  InspectorComponent: SageMakerInspector,

  aiHints: {
    summary: 'Managed ML service for notebook and model workloads.',
    role: 'Hosts ML development environments and model workflows.',
    useCases: ['ML notebooks', 'Model training', 'Model deployment'],
    keyAttributes: ['notebookName', 'instanceType', 'volumeSizeGb'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: SageMakerConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::SageMaker::NotebookInstance',
      name: getSageMakerDisplayName(config),
      connectionCount,
      details: [
        { label: 'Instance', value: config.instanceType },
        { label: 'Volume', value: `${config.volumeSizeGb} GiB` },
      ],
    };
  },
};

export default sageMakerService;
