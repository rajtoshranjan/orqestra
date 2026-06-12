import { EksIcon } from '@/components/icons';

import {
  createDefaultEksClusterConfig,
  getEksClusterDisplayName,
} from './defaults';
import { EksClusterInspector } from './eks-cluster-inspector';
import { EksClusterNode } from './eks-cluster-node';
import { validateEksClusterConfig } from './validate';

import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { EksClusterConfig } from './types';

export const eksClusterService: ServiceDefinition<EksClusterConfig> = {
  id: 'eks-cluster',
  cloudFormationType: 'AWS::EKS::Cluster',
  name: 'Amazon EKS',
  shortName: 'EKS',
  category: 'compute',
  description:
    'Managed Kubernetes service providing a production-grade control plane without managing master nodes.',
  icon: EksIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['kubernetes-cluster'],
  },
  allowedParents: ['region', 'vpc', 'environment'],
  allowedRelationships: [
    'subnet',
    'security-group',
    'iam-role',
    'ecr',
    'alb',
    'cloudwatch',
    'nlb',
    'opensearch',
    'msk',
  ],

  createDefaultConfig: createDefaultEksClusterConfig,
  validate: validateEksClusterConfig,
  getDisplayName: getEksClusterDisplayName,

  NodeComponent: EksClusterNode,
  InspectorComponent: EksClusterInspector,

  aiHints: {
    summary:
      'Managed Kubernetes service for running containerized workloads at scale.',
    role: 'Provides a production-grade Kubernetes control plane without managing master nodes.',
    useCases: [
      'Cloud-native microservices',
      'ML workloads on Kubernetes',
      'Multi-cloud container portability',
    ],
    keyAttributes: ['clusterName', 'kubernetesVersion'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: EksClusterConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::EKS::Cluster',
      name: getEksClusterDisplayName(config),
      connectionCount,
      details: [{ label: 'K8s Version', value: config.kubernetesVersion }],
    };
  },
};

export default eksClusterService;
