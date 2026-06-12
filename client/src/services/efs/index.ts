import { EfsIcon } from '@/components/icons';

import { createDefaultEFSConfig, getEFSDisplayName } from './defaults';
import { EFSInspector } from './efs-inspector';
import { EFSNode } from './efs-node';
import { validateEFSConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { EFSConfig } from './types';

export const efsService: ServiceDefinition<EFSConfig> = {
  id: 'efs',
  cloudFormationType: 'AWS::EFS::FileSystem',
  name: 'Amazon EFS',
  shortName: 'EFS',
  category: 'storage',
  description:
    'Elastic File System — simple, serverless, set-and-forget elastic file system for AWS resources.',
  icon: EfsIcon,
  accentColor: '#3F8624',
  capabilities: {
    provides: ['file-system'],
  },

  createDefaultConfig: createDefaultEFSConfig,
  validate: validateEFSConfig,
  getDisplayName: getEFSDisplayName,

  NodeComponent: EFSNode,
  InspectorComponent: EFSInspector,

  buildPlanResource: (
    nodeId: string,
    config: EFSConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EFS::FileSystem',
      name: getEFSDisplayName(config),
      connectionCount,
      details: [
        { label: 'Token', value: config.creationToken },
        { label: 'Performance', value: config.performanceMode },
        { label: 'Throughput', value: config.throughputMode },
        { label: 'APs', value: String(config.accessPoints?.length || 0) },
      ],
    };
  },
};
export default efsService;
