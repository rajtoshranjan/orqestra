import type { AlbConfig } from './types';

export function createDefaultAlbConfig(index: number): AlbConfig {
  return {
    loadBalancerName: `alb-${index}`,
    scheme: 'internet-facing',
    lbType: 'application',
  };
}

export function getAlbDisplayName(config: AlbConfig): string {
  return config.loadBalancerName.trim() || 'Load Balancer';
}
