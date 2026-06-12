import { DynamodbIcon } from '@/components/icons';

import {
  createDefaultDynamoDBConfig,
  getDynamoDBDisplayName,
} from './defaults';
import { DynamoDBInspector } from './dynamodb-inspector';
import { DynamoDBNode } from './dynamodb-node';
import { validateDynamoDBConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { DynamoDBConfig } from './types';

export const dynamodbService: ServiceDefinition<DynamoDBConfig> = {
  id: 'dynamodb',
  cloudFormationType: 'AWS::DynamoDB::Table',
  name: 'Amazon DynamoDB',
  shortName: 'DynamoDB',
  category: 'database',
  description:
    'Managed NoSQL database service supporting key-value and document data structures.',
  icon: DynamodbIcon,
  accentColor: '#3F8624',
  capabilities: {
    provides: ['event-source'],
  },

  createDefaultConfig: createDefaultDynamoDBConfig,
  validate: validateDynamoDBConfig,
  getDisplayName: getDynamoDBDisplayName,

  NodeComponent: DynamoDBNode,
  InspectorComponent: DynamoDBInspector,

  buildPlanResource: (
    nodeId: string,
    config: DynamoDBConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::DynamoDB::Table',
      name: getDynamoDBDisplayName(config),
      connectionCount,
      details: [
        { label: 'Partition Key', value: config.hashKey },
        { label: 'Stream', value: config.streamEnabled ? 'Yes' : 'No' },
      ],
    };
  },
};
export default dynamodbService;
