import { RedshiftIcon } from '@/components/icons';

import {
  createDefaultRedshiftConfig,
  getRedshiftDisplayName,
} from './defaults';
import { RedshiftInspector } from './redshift-inspector';
import { RedshiftNode } from './redshift-node';
import { validateRedshiftConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { RedshiftConfig } from './types';

export const redshiftService: ServiceDefinition<RedshiftConfig> = {
  id: 'redshift',
  cloudFormationType: 'AWS::Redshift::Cluster',
  name: 'Amazon Redshift',
  shortName: 'Redshift',
  category: 'database',
  description:
    'Petabyte-scale cloud data warehouse for analytics, business intelligence, and large-scale data queries.',
  icon: RedshiftIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['data-warehouse'],
  },
  allowedParents: ['subnet', 'vpc', 'region'],
  allowedRelationships: [
    'security-group',
    'kms',
    's3',
    'cloudwatch',
    'iam-role',
  ],

  createDefaultConfig: createDefaultRedshiftConfig,
  validate: validateRedshiftConfig,
  getDisplayName: getRedshiftDisplayName,

  NodeComponent: RedshiftNode,
  InspectorComponent: RedshiftInspector,

  aiHints: {
    summary:
      'Petabyte-scale cloud data warehouse for analytics and business intelligence.',
    role: 'Stores and queries large datasets for analytical workloads and reporting.',
    useCases: [
      'Data warehousing',
      'Business intelligence dashboards',
      'ETL pipelines',
      'Log analytics',
    ],
    keyAttributes: [
      'clusterIdentifier',
      'nodeType',
      'numberOfNodes',
      'databaseName',
    ],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: RedshiftConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Redshift::Cluster',
      name: getRedshiftDisplayName(config),
      connectionCount,
      details: [
        { label: 'Node Type', value: config.nodeType },
        { label: 'Nodes', value: String(config.numberOfNodes) },
      ],
    };
  },
};

export default redshiftService;
