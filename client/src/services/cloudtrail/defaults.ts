import type { CloudTrailConfig } from './types';

export function createDefaultCloudTrailConfig(index: number): CloudTrailConfig {
  return {
    trailName: `audit-trail-${index}`,
    destinationBucketName: `cloudtrail-logs-${index}`,
    managementEvents: 'All',
  };
}

export function getCloudTrailDisplayName(config: CloudTrailConfig): string {
  return config.trailName.trim() || 'CloudTrail';
}
