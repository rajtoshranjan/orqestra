import { EbsIcon } from '@/components/icons';

import { createDefaultEBSConfig, getEBSDisplayName } from './defaults';
import { EBSInspector } from './ebs-inspector';
import { EBSNode } from './ebs-node';
import { validateEBSConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { EBSConfig } from './types';

export const ebsService: ServiceDefinition<EBSConfig> = {
  id: 'ebs',
  cloudFormationType: 'AWS::EC2::Volume',
  name: 'Amazon EBS',
  shortName: 'EBS',
  category: 'storage',
  description:
    'Elastic Block Store — persistent, high-performance block storage volumes for use with EC2 instances.',
  icon: EbsIcon,
  accentColor: '#7CC43D',
  capabilities: {
    provides: ['block-storage'],
  },
  allowedParents: ['availability-zone', 'subnet', 'region'],
  allowedRelationships: ['ec2', 'kms'],

  createDefaultConfig: createDefaultEBSConfig,
  validate: validateEBSConfig,
  getDisplayName: getEBSDisplayName,

  NodeComponent: EBSNode,
  InspectorComponent: EBSInspector,

  aiHints: {
    summary: 'Persistent block storage volumes for use with EC2 instances.',
    role: 'Provides durable, high-performance block storage for compute workloads.',
    useCases: [
      'OS root volumes',
      'Database storage',
      'High-IOPS application data',
    ],
    keyAttributes: ['volumeName', 'volumeType', 'sizeGb', 'encrypted'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: EBSConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EC2::Volume',
      name: getEBSDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.volumeType },
        { label: 'Size', value: `${config.sizeGb} GiB` },
      ],
    };
  },
};

export default ebsService;
