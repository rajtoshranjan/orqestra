import type { AppSyncConfig } from './types';

export function createDefaultAppSyncConfig(index: number): AppSyncConfig {
  return {
    apiName: `graphql-api-${index}`,
    authenticationType: 'API_KEY',
    apiType: 'GRAPHQL',
  };
}

export function getAppSyncDisplayName(config: AppSyncConfig): string {
  return config.apiName.trim() || 'AWS AppSync';
}
