import type { APIGatewayConfig } from './types';

export function createDefaultAPIGatewayConfig(index: number): APIGatewayConfig {
  return {
    apiName: `api-gateway-${index}`,
    apiType: 'HTTP',
    stageName: 'dev',
    routes: [{ id: '1', path: '/hello', method: 'GET' }],
  };
}

export function getAPIGatewayDisplayName(config: APIGatewayConfig): string {
  return config.apiName.trim() || 'API Gateway';
}
