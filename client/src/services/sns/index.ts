import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { SNSConfig } from './types';
import { createDefaultSNSConfig, getSNSDisplayName } from './defaults';
import { validateSNSConfig } from './validate';
import { SNSNode } from './sns-node';
import { SNSInspector } from './sns-inspector';
import { SnsIcon } from '@/components/icons';

export const snsService: ServiceDefinition<SNSConfig> = {
  id: 'sns',
  cloudFormationType: 'AWS::SNS::Topic',
  name: 'Amazon SNS',
  shortName: 'SNS',
  category: 'messaging',
  description:
    'Simple Notification Service — high-throughput, push-based, many-to-many messaging topic.',
  icon: SnsIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['event-source'],
  },

  createDefaultConfig: createDefaultSNSConfig,
  validate: validateSNSConfig,
  getDisplayName: getSNSDisplayName,

  NodeComponent: SNSNode,
  InspectorComponent: SNSInspector,

  buildPlanResource: (
    nodeId: string,
    config: SNSConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::SNS::Topic',
      name: getSNSDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.fifoTopic ? 'FIFO' : 'Standard' },
      ],
    };
  },
};
export default snsService;
