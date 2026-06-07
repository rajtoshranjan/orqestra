import type { AppGroupConfig } from './types';

export function createDefaultAppGroupConfig(index: number): AppGroupConfig {
  return {
    groupName: `app-group-${index}`,
    isCollapsed: false,
  };
}

export function getAppGroupDisplayName(config: AppGroupConfig): string {
  return config.groupName.trim() || 'Application Group';
}
