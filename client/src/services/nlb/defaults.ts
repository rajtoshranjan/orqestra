import type { NlbConfig } from './types';

export function createDefaultNlbConfig(index: number): NlbConfig {
  return {
    loadBalancerName: `network-lb-${index}`,
    scheme: 'internal',
    ipAddressType: 'ipv4',
  };
}

export function getNlbDisplayName(config: NlbConfig): string {
  return config.loadBalancerName.trim() || 'Network Load Balancer';
}
