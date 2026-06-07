import type { VpcEndpointConfig } from './types';

export function createDefaultVpcEndpointConfig(
  index: number,
): VpcEndpointConfig {
  return {
    endpointName: `vpc-endpoint-${index}`,
    endpointType: 'Interface',
    serviceName: 'com.amazonaws.region.service',
  };
}

export function getVpcEndpointDisplayName(config: VpcEndpointConfig): string {
  return config.endpointName.trim() || 'VPC Endpoint';
}
