import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { AthenaConfig } from './types';
import { createDefaultAthenaConfig, getAthenaDisplayName } from './defaults';
import { validateAthenaConfig } from './validate';
import { AthenaNode } from './athena-node';
import { AthenaInspector } from './athena-inspector';
import { AthenaIcon } from '@/components/aws-icons';

export const athenaService: ServiceDefinition<AthenaConfig> = {
  id: 'athena',
  cloudFormationType: 'AWS::Athena::WorkGroup',
  name: 'Amazon Athena',
  shortName: 'Athena',
  category: 'integration',
  description:
    'Serverless interactive query service for analyzing data in Amazon S3 with SQL.',
  icon: AthenaIcon,
  accentColor: '#BF5AF2',
  capabilities: {
    provides: ['query-engine'],
  },
  allowedParents: ['account', 'region'],
  allowedRelationships: ['s3', 'glue', 'kms', 'cloudwatch', 'iam-role'],

  createDefaultConfig: createDefaultAthenaConfig,
  validate: validateAthenaConfig,
  getDisplayName: getAthenaDisplayName,

  NodeComponent: AthenaNode,
  InspectorComponent: AthenaInspector,

  aiHints: {
    summary: 'Serverless SQL query service for data stored in S3.',
    role: 'Analyzes lake data through workgroups and a Glue-backed catalog.',
    useCases: ['Data lake queries', 'Ad hoc analytics', 'Log analysis'],
    keyAttributes: ['workGroupName', 'outputLocation', 'engineVersion'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: AthenaConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Athena::WorkGroup',
      name: getAthenaDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engineVersion },
        { label: 'Output', value: config.outputLocation },
      ],
    };
  },
};

export default athenaService;
