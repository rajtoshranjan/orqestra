import { EcrIcon } from '@/components/icons';

import { createDefaultECRConfig, getECRDisplayName } from './defaults';
import { ECRInspector } from './ecr-inspector';
import { ECRNode } from './ecr-node';
import { validateECRConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { ECRConfig } from './types';

export const ecrService: ServiceDefinition<ECRConfig> = {
  id: 'ecr',
  cloudFormationType: 'AWS::ECR::Repository',
  name: 'Amazon ECR',
  shortName: 'ECR',
  category: 'storage',
  description:
    'Elastic Container Registry — store, manage, and deploy Docker container images.',
  icon: EcrIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['compute-artifact'],
  },

  createDefaultConfig: createDefaultECRConfig,
  validate: validateECRConfig,
  getDisplayName: getECRDisplayName,

  NodeComponent: ECRNode,
  InspectorComponent: ECRInspector,

  buildPlanResource: (
    nodeId: string,
    config: ECRConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::ECR::Repository',
      name: getECRDisplayName(config),
      connectionCount,
      details: [
        { label: 'Repo Name', value: config.repositoryName },
        { label: 'Mutability', value: config.imageTagMutability },
        { label: 'Scan on Push', value: config.scanOnPush ? 'Yes' : 'No' },
      ],
    };
  },
};
export default ecrService;
