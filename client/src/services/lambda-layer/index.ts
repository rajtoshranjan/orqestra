import { LambdaLayerIcon } from '@/components/icons';

import {
  createDefaultLambdaLayerConfig,
  getLambdaLayerDisplayName,
} from './defaults';
import { LambdaLayerInspector } from './lambda-layer-inspector';
import { LambdaLayerNode } from './lambda-layer-node';
import { validateLambdaLayerConfig } from './validate';

import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { LambdaLayerConfig } from './types';

export const lambdaLayerService: ServiceDefinition<LambdaLayerConfig> = {
  id: 'lambda-layer',
  cloudFormationType: 'AWS::Lambda::LayerVersion',
  name: 'AWS Lambda Layer',
  shortName: 'Layer',
  category: 'compute',
  description:
    'Shared dependency layer to bundle runtime dependencies and libraries for multiple Lambda functions.',
  icon: LambdaLayerIcon,
  accentColor: '#FF9900',
  capabilities: {
    provides: ['lambda-layer'],
  },

  createDefaultConfig: createDefaultLambdaLayerConfig,
  validate: validateLambdaLayerConfig,
  getDisplayName: getLambdaLayerDisplayName,

  NodeComponent: LambdaLayerNode,
  InspectorComponent: LambdaLayerInspector,

  buildPlanResource: (
    nodeId: string,
    config: LambdaLayerConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::Lambda::LayerVersion',
      name: getLambdaLayerDisplayName(config),
      connectionCount,
      details: [
        { label: 'Layer Name', value: config.layerName },
        {
          label: 'Runtimes',
          value: String(config.compatibleRuntimes?.length || 0),
        },
        {
          label: 'Architectures',
          value: config.compatibleArchitectures?.join(', '),
        },
      ],
    };
  },
};
export default lambdaLayerService;
