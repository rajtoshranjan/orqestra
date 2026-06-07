import type { VPCConfig } from './types';

export function createDefaultVPCConfig(index: number): VPCConfig {
  return {
    vpcName: `vpc-${index}`,
    cidrBlock: '10.0.0.0/16',
    enableDnsHostnames: true,
    enableDnsSupport: true,
  };
}

export function getVPCDisplayName(config: VPCConfig): string {
  return config.vpcName.trim() || 'VPC';
}
