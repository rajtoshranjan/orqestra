import type { RegionConfig } from './types';

export function createDefaultRegionConfig(index: number): RegionConfig {
  return {
    regionName: index === 1 ? 'us-east-1' : `us-east-${index}`,
    isCollapsed: false,
  };
}

export function getRegionDisplayName(config: RegionConfig): string {
  return config.regionName.trim() || 'Region';
}
