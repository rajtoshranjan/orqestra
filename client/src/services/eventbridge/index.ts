import { EventBridgeIcon } from '@/components/icons';

import {
  createDefaultEventBridgeConfig,
  getEventBridgeDisplayName,
} from './defaults';
import { EventBridgeInspector } from './eventbridge-inspector';
import { EventBridgeNode } from './eventbridge-node';
import { validateEventBridgeConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { EventBridgeConfig } from './types';

export const eventbridgeService: ServiceDefinition<EventBridgeConfig> = {
  id: 'eventbridge',
  cloudFormationType: 'AWS::Events::Rule',
  name: 'Amazon EventBridge',
  shortName: 'EventBridge',
  category: 'integration',
  description:
    'EventBridge Rule to run schedules (cron/rate) or respond to pattern-matched events.',
  icon: EventBridgeIcon,
  accentColor: '#DD344C',
  capabilities: {
    provides: ['event-source'],
  },

  createDefaultConfig: createDefaultEventBridgeConfig,
  validate: validateEventBridgeConfig,
  getDisplayName: getEventBridgeDisplayName,

  NodeComponent: EventBridgeNode,
  InspectorComponent: EventBridgeInspector,

  buildPlanResource: (
    nodeId: string,
    config: EventBridgeConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Events::Rule',
      name: getEventBridgeDisplayName(config),
      connectionCount,
      details: [
        {
          label: 'Schedule',
          value: config.scheduleExpression || 'Pattern-triggered',
        },
      ],
    };
  },
};
export default eventbridgeService;
