import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { OpenSearchConfig } from './types';
import {
  createDefaultOpenSearchConfig,
  getOpenSearchDisplayName,
} from './defaults';
import { validateOpenSearchConfig } from './validate';
import { OpenSearchNode } from './opensearch-node';
import { OpenSearchInspector } from './opensearch-inspector';
import { OpenSearchIcon } from '@/components/aws-icons';

export const openSearchService: ServiceDefinition<OpenSearchConfig> = {
  id: 'opensearch',
  cloudFormationType: 'AWS::OpenSearchService::Domain',
  name: 'Amazon OpenSearch Service',
  shortName: 'OpenSearch',
  category: 'database',
  description:
    'Managed search and analytics engine for logs, metrics, and application search.',
  icon: OpenSearchIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['search-analytics'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: [
    'lambda',
    'ec2',
    'ecs-cluster',
    'eks-cluster',
    'security-group',
    'cloudwatch',
    'kms',
    'cognito',
    's3',
    'bedrock',
  ],

  createDefaultConfig: createDefaultOpenSearchConfig,
  validate: validateOpenSearchConfig,
  getDisplayName: getOpenSearchDisplayName,

  NodeComponent: OpenSearchNode,
  InspectorComponent: OpenSearchInspector,

  aiHints: {
    summary: 'Managed search and analytics domain for operational data.',
    role: 'Indexes logs, traces, documents, and vectors for search workloads.',
    useCases: ['Log analytics', 'Application search', 'Vector search'],
    keyAttributes: ['domainName', 'engineVersion', 'instanceType'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: OpenSearchConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::OpenSearchService::Domain',
      name: getOpenSearchDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engineVersion },
        { label: 'Instance', value: config.instanceType },
      ],
    };
  },
};

export default openSearchService;
