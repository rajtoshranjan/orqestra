import type { SecurityGroupConfig, SecurityGroupRule } from './types';

export function makeEmptyRule(): SecurityGroupRule {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    id,
    protocol: 'tcp',
    fromPort: 443,
    toPort: 443,
    cidrBlock: '0.0.0.0/0',
  };
}

export function createDefaultSecurityGroupConfig(
  index: number,
): SecurityGroupConfig {
  const egressId =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return {
    groupName: `security-group-${index}`,
    description: 'Managed by Orqestra',
    ingressRules: [],
    egressRules: [
      {
        id: egressId,
        protocol: '-1',
        fromPort: -1,
        toPort: -1,
        cidrBlock: '0.0.0.0/0',
      },
    ],
  };
}

export function getSecurityGroupDisplayName(
  config: SecurityGroupConfig,
): string {
  return config.groupName.trim() || 'Security Group';
}
