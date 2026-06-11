import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { S3Config } from './types';
import { createDefaultS3Config, getS3DisplayName } from './defaults';
import { validateS3Config } from './validate';
import { S3Node } from './s3-node';
import { S3Inspector } from './s3-inspector';
import { S3Icon } from '@/components/icons';

export const s3Service: ServiceDefinition<S3Config> = {
  id: 's3',
  cloudFormationType: 'AWS::S3::Bucket',
  name: 'Amazon S3',
  shortName: 'S3',
  category: 'storage',
  description:
    'Simple Storage Service — object storage built to store and retrieve any amount of data from anywhere.',
  icon: S3Icon,
  accentColor: '#3F8624',
  capabilities: {
    provides: ['event-source', 'file-system'],
  },

  createDefaultConfig: createDefaultS3Config,
  validate: validateS3Config,
  getDisplayName: getS3DisplayName,

  NodeComponent: S3Node,
  InspectorComponent: S3Inspector,

  buildPlanResource: (
    nodeId: string,
    config: S3Config,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::S3::Bucket',
      name: getS3DisplayName(config),
      connectionCount,
      details: [
        {
          label: 'Versioning',
          value: config.versioning ? 'Enabled' : 'Disabled',
        },
      ],
    };
  },
};
export default s3Service;
