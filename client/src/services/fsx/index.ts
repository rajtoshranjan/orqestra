import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { FSxConfig } from './types';
import { createDefaultFSxConfig, getFSxDisplayName } from './defaults';
import { validateFSxConfig } from './validate';
import { FSxNode } from './fsx-node';
import { FSxInspector } from './fsx-inspector';
import { FsxIcon } from '@/components/aws-icons';

export const fsxService: ServiceDefinition<FSxConfig> = {
  id: 'fsx',
  cloudFormationType: 'AWS::FSx::FileSystem',
  name: 'Amazon FSx',
  shortName: 'FSx',
  category: 'storage',
  description:
    'Fully managed, high-performance file systems built on popular file system technologies.',
  icon: FsxIcon,
  accentColor: '#7CC43D',
  capabilities: {
    provides: ['managed-file-system'],
  },
  allowedParents: ['subnet', 'vpc', 'region'],
  allowedRelationships: ['security-group', 'kms', 'ec2', 'ecs-cluster'],

  createDefaultConfig: createDefaultFSxConfig,
  validate: validateFSxConfig,
  getDisplayName: getFSxDisplayName,

  NodeComponent: FSxNode,
  InspectorComponent: FSxInspector,

  aiHints: {
    summary:
      'Fully managed high-performance file systems built on popular file system types.',
    role: 'Provides shared file storage for compute-intensive and enterprise workloads.',
    useCases: [
      'HPC and ML training data',
      'Windows shared file storage',
      'NetApp ONTAP migrations',
    ],
    keyAttributes: ['fileSystemName', 'fileSystemType', 'storageCapacityGb'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: FSxConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::FSx::FileSystem',
      name: getFSxDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.fileSystemType },
        { label: 'Capacity', value: `${config.storageCapacityGb} GiB` },
      ],
    };
  },
};

export default fsxService;
