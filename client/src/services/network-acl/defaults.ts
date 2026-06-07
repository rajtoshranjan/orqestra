import type { NetworkAclConfig } from './types';

export function createDefaultNetworkAclConfig(index: number): NetworkAclConfig {
  return {
    aclName: `nacl-${index}`,
    defaultAction: 'deny',
  };
}

export function getNetworkAclDisplayName(config: NetworkAclConfig): string {
  return config.aclName.trim() || 'Network ACL';
}
