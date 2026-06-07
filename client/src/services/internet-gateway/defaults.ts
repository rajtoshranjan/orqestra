import type { InternetGatewayConfig } from './types';

export function createDefaultInternetGatewayConfig(
  index: number,
): InternetGatewayConfig {
  return {
    gatewayName: `igw-${index}`,
  };
}

export function getInternetGatewayDisplayName(
  config: InternetGatewayConfig,
): string {
  return config.gatewayName.trim() || 'Internet Gateway';
}
