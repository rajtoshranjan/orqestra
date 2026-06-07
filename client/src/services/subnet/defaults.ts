import type { SubnetConfig } from './types';

export function createDefaultSubnetConfig(index: number): SubnetConfig {
  return {
    subnetName: `subnet-${index}`,
    cidrBlock: `10.0.${index}.0/24`,
    availabilityZone: 'us-east-1a',
    mapPublicIpOnLaunch: false,
    subnetType: 'private',
  };
}

export function getSubnetDisplayName(config: SubnetConfig): string {
  return config.subnetName.trim() || 'Subnet';
}
