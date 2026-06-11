import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { SQSConfig } from './types';
import { createDefaultSQSConfig, getSQSDisplayName } from './defaults';
import { validateSQSConfig } from './validate';
import { SQSNode } from './sqs-node';
import { SQSInspector } from './sqs-inspector';
import { SqsIcon } from '@/components/icons';

export const sqsService: ServiceDefinition<SQSConfig> = {
  id: 'sqs',
  cloudFormationType: 'AWS::SQS::Queue',
  name: 'Amazon SQS',
  shortName: 'SQS',
  category: 'messaging',
  description:
    'Simple Queue Service — secure, durable, and available hosted queue for decoupling distributed system components.',
  icon: SqsIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['event-source'],
  },

  createDefaultConfig: createDefaultSQSConfig,
  validate: validateSQSConfig,
  getDisplayName: getSQSDisplayName,

  NodeComponent: SQSNode,
  InspectorComponent: SQSInspector,

  buildPlanResource: (
    nodeId: string,
    config: SQSConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::SQS::Queue',
      name: getSQSDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.fifoQueue ? 'FIFO' : 'Standard' },
        {
          label: 'Visibility Timeout',
          value: `${config.visibilityTimeoutSeconds}s`,
        },
      ],
    };
  },
};
export default sqsService;
