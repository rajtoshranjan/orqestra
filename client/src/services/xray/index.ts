import type {
  ServiceDefinition,
  ServicePlanResource,
  AIHints,
  DeploymentHints,
} from '../types';
import type { XRayConfig } from './types';
import { createDefaultXRayConfig, getXRayDisplayName } from './defaults';
import { validateXRayConfig } from './validate';
import { XRayNode } from './xray-node';
import { XRayInspector } from './xray-inspector';
import { XRayIcon } from '@/components/aws-icons';

export const xrayService: ServiceDefinition<XRayConfig> = {
  id: 'xray',
  cloudFormationType: 'AWS::XRay::Group',
  name: 'AWS X-Ray',
  shortName: 'X-Ray',
  category: 'monitoring',
  description:
    'Distributed tracing service for debugging and analysing microservices applications.',
  icon: XRayIcon,
  accentColor: '#FF4F8B',
  capabilities: {
    provides: ['tracing-service'],
  },
  allowedParents: ['account', 'region', 'environment'],
  allowedRelationships: [
    'lambda',
    'ec2',
    'api-gateway',
    'ecs-cluster',
    'eks-cluster',
  ],

  createDefaultConfig: createDefaultXRayConfig,
  validate: validateXRayConfig,
  getDisplayName: getXRayDisplayName,

  NodeComponent: XRayNode,
  InspectorComponent: XRayInspector,

  aiHints: {
    summary:
      'Distributed tracing service for debugging and analysing microservices applications.',
    role: 'Provides end-to-end visibility into request flows across distributed systems.',
    useCases: [
      'Request latency analysis',
      'Error root cause investigation',
      'Service dependency mapping',
      'Performance bottleneck detection',
    ],
    keyAttributes: ['groupName', 'samplingRate'],
  } satisfies AIHints,

  deploymentHints: { isDeployable: true } satisfies DeploymentHints,

  buildPlanResource: (
    nodeId: string,
    config: XRayConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::XRay::Group',
      name: getXRayDisplayName(config),
      connectionCount,
      details: [{ label: 'Sampling Rate', value: `${config.samplingRate}%` }],
    };
  },
};

export default xrayService;
