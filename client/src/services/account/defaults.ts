import type { AccountConfig } from './types';

export function createDefaultAccountConfig(): AccountConfig {
  return {
    accountId: '123456789012',
    isCollapsed: false,
  };
}

export function getAccountDisplayName(config: AccountConfig): string {
  return `Account: ${config.accountId}`.trim() || 'AWS Account';
}
