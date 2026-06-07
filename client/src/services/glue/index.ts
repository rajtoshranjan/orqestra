import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { GlueConfig } from './types';
import { createDefaultGlueConfig, getGlueDisplayName } from './defaults';
import { validateGlueConfig } from './validate';
import { GlueNode } from './glue-node';
import { GlueInspector } from './glue-inspector';
import { GlueIcon } from '@/components/aws-icons';

export const glueService: ServiceDefinition<GlueConfig> = {
  id: 'glue',
  cloudFormationType: 'AWS::Glue::Database',
  name: 'AWS Glue',
  shortName: 'Glue',
  category: 'integration',
  description:
    'Serverless data integration service for catalogs, crawlers, and ETL pipelines.',
  icon: GlueIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['data-catalog'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: [
    's3',
    'athena',
    'redshift',
    'rds',
    'msk',
    'iam-role',
    'cloudwatch',
  ],

  createDefaultConfig: createDefaultGlueConfig,
  validate: validateGlueConfig,
  getDisplayName: getGlueDisplayName,

  NodeComponent: GlueNode,
  InspectorComponent: GlueInspector,

  aiHints: {
    summary: 'Data catalog and ETL service for analytics workloads.',
    role: 'Discovers, catalogs, and transforms data for query and ML services.',
    useCases: ['Data lake catalog', 'ETL jobs', 'Crawler-based discovery'],
    keyAttributes: ['databaseName', 'crawlerName', 'dataSourceType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: GlueConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Glue::Database',
      name: getGlueDisplayName(config),
      connectionCount,
      details: [
        { label: 'Crawler', value: config.crawlerName },
        { label: 'Source', value: config.dataSourceType },
      ],
    };
  },
};

export default glueService;
