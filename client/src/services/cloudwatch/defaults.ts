import type { CloudWatchConfig } from './types';

export function createDefaultCloudWatchConfig(index: number): CloudWatchConfig {
  return {
    dashboardName: `dashboard-${index}`,
    retentionDays: 30,
    alarmPrefix: 'alarm',
  };
}

export function getCloudWatchDisplayName(config: CloudWatchConfig): string {
  return config.dashboardName.trim() || 'CloudWatch Dashboard';
}
