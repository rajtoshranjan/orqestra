import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { AuroraConfig } from './types';
import { createDefaultAuroraConfig, getAuroraDisplayName } from './defaults';
import { validateAuroraConfig } from './validate';
import { AuroraNode } from './aurora-node';
import { AuroraInspector } from './aurora-inspector';
import { AuroraIcon } from '@/components/icons';

export const auroraService: ServiceDefinition<AuroraConfig> = {
  id: 'aurora',
  cloudFormationType: 'AWS::RDS::DBCluster',
  name: 'Amazon Aurora',
  shortName: 'Aurora',
  category: 'database',
  description:
    'MySQL and PostgreSQL-compatible relational database with auto-scaling storage and high availability.',
  icon: AuroraIcon,
  accentColor: '#A166FF',
  capabilities: {
    provides: ['relational-database'],
  },
  allowedParents: ['subnet', 'vpc', 'region'],
  allowedRelationships: [
    'security-group',
    'kms',
    'secrets-manager',
    'lambda',
    'ec2',
    'cloudwatch',
    'iam-role',
  ],

  createDefaultConfig: createDefaultAuroraConfig,
  validate: validateAuroraConfig,
  getDisplayName: getAuroraDisplayName,

  NodeComponent: AuroraNode,
  InspectorComponent: AuroraInspector,

  aiHints: {
    summary:
      'MySQL and PostgreSQL-compatible relational database with auto-scaling storage.',
    role: 'High-performance, highly available relational database for cloud-native applications.',
    useCases: [
      'Cloud-native transactional databases',
      'Serverless database workloads',
      'Global distributed databases',
    ],
    keyAttributes: ['clusterIdentifier', 'engine', 'serverless'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: AuroraConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::RDS::DBCluster',
      name: getAuroraDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engine },
        { label: 'Serverless', value: config.serverless ? 'Yes' : 'No' },
      ],
    };
  },
};

export default auroraService;
