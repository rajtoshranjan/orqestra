import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { CloudWatchConfig } from './types';
import {
  createDefaultCloudWatchConfig,
  getCloudWatchDisplayName,
} from './defaults';
import { validateCloudWatchConfig } from './validate';
import { CloudWatchNode } from './cloudwatch-node';
import { CloudWatchInspector } from './cloudwatch-inspector';
import { CloudWatchIcon } from '@/components/aws-icons';

export const cloudwatchService: ServiceDefinition<CloudWatchConfig> = {
  id: 'cloudwatch',
  cloudFormationType: 'AWS::CloudWatch::Dashboard',
  name: 'Amazon CloudWatch',
  shortName: 'CloudWatch',
  category: 'monitoring',
  description:
    'Monitoring and observability service for AWS resources and applications.',
  icon: CloudWatchIcon,
  accentColor: '#FF4F8B',
  isContainer: false,
  capabilities: {
    provides: ['monitoring-service'],
  },
  allowedParents: ['account', 'region', 'environment'],
  allowedRelationships: [
    'lambda',
    'ec2',
    'rds',
    'sqs',
    'sns',
    'api-gateway',
    'alb',
    'ecs-cluster',
    'iam-role',
  ],

  createDefaultConfig: createDefaultCloudWatchConfig,
  validate: validateCloudWatchConfig,
  getDisplayName: getCloudWatchDisplayName,

  NodeComponent: CloudWatchNode,
  InspectorComponent: CloudWatchInspector,

  aiHints: {
    summary:
      'Monitoring and observability service for AWS resources and applications.',
    role: 'Collects metrics, logs, and events for operational visibility.',
    useCases: [
      'Resource monitoring dashboards',
      'Alert-based auto-scaling',
      'Log aggregation and analysis',
    ],
    keyAttributes: ['dashboardName', 'retentionDays', 'alarmPrefix'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: CloudWatchConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::CloudWatch::Dashboard',
      name: getCloudWatchDisplayName(config),
      connectionCount,
      details: [
        { label: 'Retention', value: `${config.retentionDays}d` },
        { label: 'Alarm Prefix', value: config.alarmPrefix },
      ],
    };
  },
};

export default cloudwatchService;
