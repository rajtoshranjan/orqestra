import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { MskConfig } from './types';
import { createDefaultMskConfig, getMskDisplayName } from './defaults';
import { validateMskConfig } from './validate';
import { MskNode } from './msk-node';
import { MskInspector } from './msk-inspector';
import { MskIcon } from '@/components/icons';

export const mskService: ServiceDefinition<MskConfig> = {
  id: 'msk',
  cloudFormationType: 'AWS::MSK::Cluster',
  name: 'Amazon MSK',
  shortName: 'MSK',
  category: 'messaging',
  description:
    'Managed Apache Kafka service for streaming data pipelines and event-driven applications.',
  icon: MskIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['event-stream'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: [
    'lambda',
    'ecs-cluster',
    'eks-cluster',
    'ec2',
    'security-group',
    'cloudwatch',
    'glue',
  ],

  createDefaultConfig: createDefaultMskConfig,
  validate: validateMskConfig,
  getDisplayName: getMskDisplayName,

  NodeComponent: MskNode,
  InspectorComponent: MskInspector,

  aiHints: {
    summary: 'Managed Apache Kafka cluster for streaming events and logs.',
    role: 'Acts as a durable event backbone for producers and consumers.',
    useCases: [
      'Streaming data pipelines',
      'Event-driven microservices',
      'Log aggregation',
    ],
    keyAttributes: [
      'clusterName',
      'kafkaVersion',
      'brokerInstanceType',
      'brokerCount',
    ],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: MskConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::MSK::Cluster',
      name: getMskDisplayName(config),
      connectionCount,
      details: [
        { label: 'Kafka', value: config.kafkaVersion },
        { label: 'Brokers', value: String(config.brokerCount) },
      ],
    };
  },
};

export default mskService;
