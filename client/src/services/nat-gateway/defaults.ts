import type { NatGatewayConfig } from './types';

export function createDefaultNatGatewayConfig(index: number): NatGatewayConfig {
  return {
    natGatewayName: `nat-gateway-${index}`,
    connectivityType: 'public',
  };
}

export function getNatGatewayDisplayName(config: NatGatewayConfig): string {
  return config.natGatewayName.trim() || 'NAT Gateway';
}
