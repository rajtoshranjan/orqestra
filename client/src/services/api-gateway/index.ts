import type { ServiceDefinition, ServicePlanResource } from '../types';
import type { APIGatewayConfig } from './types';
import {
  createDefaultAPIGatewayConfig,
  getAPIGatewayDisplayName,
} from './defaults';
import { validateAPIGatewayConfig } from './validate';
import { APIGatewayNode } from './api-gateway-node';
import { APIGatewayInspector } from './api-gateway-inspector';
import { ApiGatewayIcon } from '@/components/aws-icons';

export const apiGatewayService: ServiceDefinition<APIGatewayConfig> = {
  id: 'api-gateway',
  cloudFormationType: 'AWS::ApiGatewayV2::Api',
  name: 'AWS API Gateway',
  shortName: 'API Gateway',
  category: 'integration',
  description:
    'API Gateway to publish, maintain, monitor, and secure HTTP, REST, and WebSocket APIs.',
  icon: ApiGatewayIcon,
  accentColor: '#A166FF',
  capabilities: {
    provides: ['event-source'],
  },

  createDefaultConfig: createDefaultAPIGatewayConfig,
  validate: validateAPIGatewayConfig,
  getDisplayName: getAPIGatewayDisplayName,

  NodeComponent: APIGatewayNode,
  InspectorComponent: APIGatewayInspector,

  buildPlanResource: (
    nodeId: string,
    config: APIGatewayConfig,
    connectionCount: number,
  ): ServicePlanResource => {
    return {
      id: nodeId,
      cloudFormationType: 'AWS::ApiGatewayV2::Api',
      name: getAPIGatewayDisplayName(config),
      connectionCount,
      details: [
        { label: 'Type', value: config.apiType },
        { label: 'Stage', value: config.stageName },
        { label: 'Routes', value: String(config.routes?.length || 0) },
      ],
    };
  },
};
export default apiGatewayService;
