import { DocumentDbIcon } from '@/components/icons';

import {
  createDefaultDocumentDbConfig,
  getDocumentDbDisplayName,
} from './defaults';
import { DocumentDbInspector } from './documentdb-inspector';
import { DocumentDbNode } from './documentdb-node';
import { validateDocumentDbConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { DocumentDbConfig } from './types';

export const documentDbService: ServiceDefinition<DocumentDbConfig> = {
  id: 'documentdb',
  cloudFormationType: 'AWS::DocDB::DBCluster',
  name: 'Amazon DocumentDB',
  shortName: 'DocumentDB',
  category: 'database',
  description:
    'Managed document database service compatible with MongoDB workloads.',
  icon: DocumentDbIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['document-database'],
  },
  allowedParents: ['vpc', 'subnet', 'region'],
  allowedRelationships: [
    'security-group',
    'kms',
    'secrets-manager',
    'lambda',
    'ec2',
    'cloudwatch',
  ],

  createDefaultConfig: createDefaultDocumentDbConfig,
  validate: validateDocumentDbConfig,
  getDisplayName: getDocumentDbDisplayName,

  NodeComponent: DocumentDbNode,
  InspectorComponent: DocumentDbInspector,

  aiHints: {
    summary: 'Managed MongoDB-compatible document database cluster.',
    role: 'Stores JSON-like documents for application workloads.',
    useCases: [
      'Document-oriented application data',
      'MongoDB migration',
      'Managed cluster storage',
    ],
    keyAttributes: ['clusterIdentifier', 'engineVersion', 'instanceClass'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: DocumentDbConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::DocDB::DBCluster',
      name: getDocumentDbDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engineVersion },
        { label: 'Class', value: config.instanceClass },
      ],
    };
  },
};

export default documentDbService;
