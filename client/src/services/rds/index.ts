import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { RDSConfig } from './types';
import { createDefaultRDSConfig, getRDSDisplayName } from './defaults';
import { validateRDSConfig } from './validate';
import { RDSNode } from './rds-node';
import { RDSInspector } from './rds-inspector';
import { RdsIcon } from '@/components/icons';

export const rdsService: ServiceDefinition<RDSConfig> = {
  id: 'rds',
  cloudFormationType: 'AWS::RDS::DBInstance',
  name: 'Amazon RDS',
  shortName: 'RDS',
  category: 'database',
  description:
    'Managed relational database service supporting multiple database engines.',
  icon: RdsIcon,
  accentColor: '#29B0D9',
  isContainer: false,
  capabilities: {
    provides: ['relational-database'],
  },
  allowedParents: ['subnet', 'availability-zone', 'vpc'],
  allowedRelationships: [
    'security-group',
    'kms',
    'secrets-manager',
    'lambda',
    'ec2',
    'cloudwatch',
  ],

  createDefaultConfig: createDefaultRDSConfig,
  validate: validateRDSConfig,
  getDisplayName: getRDSDisplayName,

  NodeComponent: RDSNode,
  InspectorComponent: RDSInspector,

  aiHints: {
    summary:
      'Managed relational database service supporting multiple database engines.',
    role: 'Provides persistent relational data storage with automated backups and failover.',
    useCases: [
      'Application databases',
      'Data warehousing',
      'Multi-AZ high availability databases',
    ],
    keyAttributes: ['instanceIdentifier', 'engine', 'instanceClass', 'multiAz'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: RDSConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::RDS::DBInstance',
      name: getRDSDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engine },
        { label: 'Instance Class', value: config.instanceClass },
      ],
    };
  },
};

export default rdsService;
