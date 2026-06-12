import { KinesisIcon } from '@/components/icons';

import { createDefaultKinesisConfig, getKinesisDisplayName } from './defaults';
import { KinesisInspector } from './kinesis-inspector';
import { KinesisNode } from './kinesis-node';
import { validateKinesisConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { KinesisConfig } from './types';

export const kinesisService: ServiceDefinition<KinesisConfig> = {
  id: 'kinesis',
  cloudFormationType: 'AWS::Kinesis::Stream',
  name: 'Amazon Kinesis',
  shortName: 'Kinesis',
  category: 'messaging',
  description:
    'Kinesis Data Streams — collect and process large streams of data records in real time.',
  icon: KinesisIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['event-source'],
  },

  createDefaultConfig: createDefaultKinesisConfig,
  validate: validateKinesisConfig,
  getDisplayName: getKinesisDisplayName,

  NodeComponent: KinesisNode,
  InspectorComponent: KinesisInspector,

  buildPlanResource: (
    nodeId: string,
    config: KinesisConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Kinesis::Stream',
      name: getKinesisDisplayName(config),
      connectionCount,
      details: [
        { label: 'Shards', value: String(config.shardCount) },
        { label: 'Retention', value: `${config.retentionPeriod}h` },
      ],
    };
  },
};
export default kinesisService;
