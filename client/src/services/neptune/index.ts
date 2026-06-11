import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { NeptuneConfig } from './types';
import { createDefaultNeptuneConfig, getNeptuneDisplayName } from './defaults';
import { validateNeptuneConfig } from './validate';
import { NeptuneNode } from './neptune-node';
import { NeptuneInspector } from './neptune-inspector';
import { NeptuneIcon } from '@/components/icons';

export const neptuneService: ServiceDefinition<NeptuneConfig> = {
  id: 'neptune',
  cloudFormationType: 'AWS::Neptune::DBCluster',
  name: 'Amazon Neptune',
  shortName: 'Neptune',
  category: 'database',
  description:
    'Managed graph database service for highly connected datasets and relationship queries.',
  icon: NeptuneIcon,
  accentColor: '#29B0D9',
  capabilities: {
    provides: ['graph-database'],
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

  createDefaultConfig: createDefaultNeptuneConfig,
  validate: validateNeptuneConfig,
  getDisplayName: getNeptuneDisplayName,

  NodeComponent: NeptuneNode,
  InspectorComponent: NeptuneInspector,

  aiHints: {
    summary: 'Managed graph database cluster for relationship-heavy data.',
    role: 'Stores and queries graph data using graph traversal patterns.',
    useCases: [
      'Knowledge graphs',
      'Fraud detection',
      'Recommendation relationships',
    ],
    keyAttributes: ['clusterIdentifier', 'engineVersion', 'instanceClass'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: NeptuneConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Neptune::DBCluster',
      name: getNeptuneDisplayName(config),
      connectionCount,
      details: [
        { label: 'Engine', value: config.engineVersion },
        { label: 'Class', value: config.instanceClass },
      ],
    };
  },
};

export default neptuneService;
