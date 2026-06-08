import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { AmazonMqConfig } from './types';
import {
  createDefaultAmazonMqConfig,
  getAmazonMqDisplayName,
} from './defaults';
import { validateAmazonMqConfig } from './validate';
import { AmazonMqNode } from './amazon-mq-node';
import { AmazonMqInspector } from './amazon-mq-inspector';
import { AmazonMqIcon } from '@/components/aws-icons';

export const amazonMqService: ServiceDefinition<AmazonMqConfig> = {
  id: 'amazon-mq',
  cloudFormationType: 'AWS::AmazonMQ::Broker',
  name: 'Amazon MQ',
  shortName: 'Amazon MQ',
  category: 'messaging',
  description:
    'Managed message broker service for Apache ActiveMQ and RabbitMQ that simplifies migration to the cloud.',
  icon: AmazonMqIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['message-broker'],
  },
  allowedParents: ['vpc', 'region'],
  allowedRelationships: [
    'lambda',
    'ec2',
    'ecs-cluster',
    'security-group',
    'cloudwatch',
  ],

  createDefaultConfig: createDefaultAmazonMqConfig,
  validate: validateAmazonMqConfig,
  getDisplayName: getAmazonMqDisplayName,

  NodeComponent: AmazonMqNode,
  InspectorComponent: AmazonMqInspector,

  aiHints: {
    summary: 'Managed message broker for ActiveMQ and RabbitMQ workloads.',
    role: 'Enables migration of on-premises message broker applications to the cloud.',
    useCases: [
      'Legacy messaging migration',
      'AMQP/MQTT workloads',
      'Enterprise application integration',
    ],
    keyAttributes: ['brokerName', 'engineType', 'deploymentMode'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: AmazonMqConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::AmazonMQ::Broker',
      name: getAmazonMqDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engineType },
        { label: 'Mode', value: config.deploymentMode },
      ],
    };
  },
};

export default amazonMqService;
