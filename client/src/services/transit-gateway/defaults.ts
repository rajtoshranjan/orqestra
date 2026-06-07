import type { TransitGatewayConfig } from './types';

export function createDefaultTransitGatewayConfig(
  index: number,
): TransitGatewayConfig {
  return {
    transitGatewayName: `tgw-${index}`,
    amazonSideAsn: 64512,
  };
}

export function getTransitGatewayDisplayName(
  config: TransitGatewayConfig,
): string {
  return config.transitGatewayName.trim() || 'Transit Gateway';
}
